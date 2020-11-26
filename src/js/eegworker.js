//var full = location.protocol + location.pathname;
//var localpath = full.substr(0,full.lastIndexOf("/"));
//var parentpath = localpath.substr(0,localpath.lastIndexOf("/"));

import { gpuUtils } from './utils/gpuUtils.js';
import { eegmath } from './eeg32';


const gpu = new gpuUtils();

onmessage = (e) => {
  // define gpu instance
  console.time("worker");
  let output = "function not defined";

  switch (e.data.foo) {
    case "xcor": // Takes 2 1D arrays
      output = eegmath.crosscorrelation(e.data.input[0],e.data.input[1]);
      break;
    case "autocor": // Takes 1 1D array
      output = eegmath.autocorrelation(e.data.input);
      break;
    case "cov1d": // Takes 2 1D arrays
      output = eegmath.cov1d(e.data.input[0],e.data.input[1]);
      break;
    case "cov2d": // Takes 1 2D array with equal width rows
      output = eegmath.cov2d(e.data.input);
      break;
    case "sma": // Takes 1 1D array and an sma window size
      output = eegmath.sma(e.data.input[0],e.data.input[1]);
      break;
    case "dft": // Takes 1 1D array and the number of seconds
      output = gpu.gpuDFT(e.data.input[0],e.data.input[1]);
      break;
    case "multidft": //Takes 1 2D array with equal width rows, and the number of seconds of data being given
      output = gpu.MultiChannelDFT(e.data.input[0],e.data.input[1]);
      break;
    case "multidftbandpass": //Accepts 1 2D array of equal width, number of seconds of data, beginning frequency, ending frequency
        output = gpu.MultiChannelDFT_Bandpass(e.data.input[0],e.data.input[1],e.data.input[2],e.data.input[3]);
        break;
    case "coherence": // Input 2D array, number of seconds, beginning frequency, ending frequency. Outputs an array of products of each FFT with each associated correlogram to create a network map of all available channels, ordered by channel
      const correlograms = eegmath.correlograms(e.data.input[0]); 
      const buffer = [...e.data.input[0],...correlograms];
      const dfts = gpu.MultiChannelDFT_Bandpass(buffer, e.data.input[1], e.data.input[2], e.data.input[3]);
      const cordfts = dfts[1].splice(e.data.input[0].length, dfts[1].length-e.data.input[0].length);

      const coherenceResults = []; 
      const nChannels = e.data.input[0].length;
      
      //cross-correlation dfts arranged like e.g. for 4 channels: [0:0, 0:1, 0:2, 0:3, 0:4, 1:1, 1:2, 1:3, 1:4, 2:2, 2:3, 2:4, 3:3, 3:4] etc.
      var k=0;
      cordfts.forEach((row,i) => { //move autocorrelation results to front to save brain power
        if (i == nChannels-k) {
          var temp = cordfts[i].splice(i,1);
          k++;
          cordfts[k].splice(k,0,temp);
        }
      });
      //Now arranged like [0:0,1:1,2:2,3:3,4:4,0:1,0:2,0:3,0:4,1:2,1:3,1:4,2:3,2:4,3:4]

      //Outputs FFT coherence data in order of channel data inputted e.g. for 4 channels resulting DFTs = [0:1,0:2,0:3,0:4,1:2,1:3,1:4,2:3,2:4,3:4];
      //TODO:Optimize this e.g. with a bulk dispatch to GPUJs
      var autoFFTproducts = [];
      k = 0;
      var l = 1;
      cordfts.forEach((dft,i) => {
        var newdft = [];
        if(i < nChannels) { //first multiply autocorrelograms
          dft.forEach((amp,j) => {
            newdft.push(amp*dfts[1][i][j]*100);
          });
          autoFFTproducts.push(newdft);
        }
        else{ //now multiply cross correlograms
          
          dft.forEach((amp,j) => {           
              newdft.push(amp*autoFFTproducts[k][j]*autoFFTproducts[k+l][j]*100);
          });
          l++;
          if((l+k) === nChannels) {
            k++;
            l = 1;
          }
          coherenceResults.push(newdft);
        }
      });

      output = [dfts[0], dfts[1], coherenceResults];

      
      break;
  }

  // output some results!
  console.timeEnd("worker");
  //console.log("In worker: ", output);

  postMessage({output: output,foo: e.data.foo});
};
