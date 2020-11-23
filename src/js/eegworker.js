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
    case "coherence": // Input 2D array, number of seconds, beginning frequency, ending frequency. Outputs an array of products of each FFT with each associated correlogram, ordered by channel
      const correlograms = eegmath.correlograms(e.data.input[0]); 
      const buffer = [...e.data.input[0],...correlograms];
      const dfts = gpu.multiChannelDFT_Bandpass(buffer, e.data.input[1], e.data.input[2], e.data.input[3]);
      const cordfts = dfts[1].splice(e.data.input[0].length, dfts[1].length-e.data.input[0].length);

      const coherenceResults = []; 
      const nChannels = e.data.input[0].length;
      //cordfts arranged like e.g. for 4 channels: [0:0, 0:1, 0:2, 0:3, 1:1, 1:2, 1:3, 2:2, 2:3, 3:3] etc.
      //For channels 0 and 1,
      //Multiply channel 0 DFT by channel 0 autocorrelation DFT
      //Multiply channel 1 DFT by channel 1 autocorrelation DFT
      //Multiply these two results together with the cross correlation DFT between channel 0 and 1.
      //Outputs coherence data in order of channel data inputted e.g. for 4 channels resulting DFTs = [0:1,0:2,0:3,1:2,1:3,2:3];
      /*dfts.forEach((row,i) => {
        var k = i;
        while (k < nChannels){
          coherenceResults.push([]);
          dfts[k].forEach((amp,j) => {
            //First multiply autocorrelations of each channel
            var a1 = dfts[k][j] * cordfts[nChannels*i-k+1][j];
            var a2 = dfts[][j] * cordfts[][j];
            var prod = a1 * a2 * cordfts[k+i][j];

            coherenceResults[coherenceResults.length - 1].push(prod);
          });
          k++;
        }
      });*/
      break;
  }

  // output some results!
  console.timeEnd("worker");
  //console.log("In worker: ", output);

  postMessage({output: output,foo: e.data.foo});
};
