//var full = location.protocol + location.pathname;
//var localpath = full.substr(0,full.lastIndexOf("/"));
//var parentpath = localpath.substr(0,localpath.lastIndexOf("/"));

import {gpuUtils} from './utils/gpuUtils.js';
import {eegmath} from './eeg32';


const gpu = new gpuUtils();

onmessage = function(e) {
  // define gpu instance
  console.time("worker");
    var output = 0;

    if(e.data.foo === "xcor"){ output = eegmath.crosscorrelation(e.data.input[0],e.data.input[1]);} //Takes 2 1D arrays
    else if(e.data.foo === "autocor"){ output = eegmath.autocorrelation(e.data.input);}      //Takes 1 1D array
    else if(e.data.foo === "cov1d"){ output = eegmath.cov1d(e.data.input[0],e.data.input[1]);} //Takes 2 1D arrays
    else if(e.data.foo === "cov2d"){ output = eegmath.cov2d(e.data.input); }              //Takes 1 2D array with equal width rows
    else if(e.data.foo === "sma"){ output = eegmath.sma(e.data.input[0],e.data.input[1]);}   //Takes 1 1D array and an sma window size
    else if(e.data.foo === "dft"){ //Takes 1 1D array and the number of seconds 
        output = gpu.gpuDFT(e.data.input[0],e.data.input[1]); 
    }              
    else if(e.data.foo === "multidft") { //Takes 1 2D array with equal width rows, and the number of seconds of data being given
        output = gpu.MultiChannelDFT(e.data.input[0],e.data.input[1]);
    }  
    else if(e.data.foo === "multibandpassdft") { //Accepts 1 2D array of equal width, number of seconds of data, beginning frequency, ending frequency
        output = gpu.MultiChannelDFT_Bandpass(e.data.input[0],e.data.input[1],e.data.input[2],e.data.input[3]);} 
    else {output = "function not defined"}

  // output some results!
  console.timeEnd("worker");
  postMessage(output);
};
