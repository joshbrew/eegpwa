function correlograms(arrays, len) {
    return this.thread.x;
}

//Return frequency domain based on DFT
function dft(signal, len) {
    var result = DFT(signal,len, this.thread.x);
    return mag(result[0], result[1]);
}

function idft(amplitudes, len) {
    var result = iDFT(amplitudes, len, this.thread.x);
    return mag(result[0], result[1]);
}

// Takes a 2D array input [signal1[],signal2[],signal3[]]; does not work atm
function listdft2D(signals) {
    var len = this.output.x;
    var result = DFT(signals[this.thread.y],len,this.thread.x);
    //var mag = Math.sqrt(real[k]*real[k]+imag[k]*imag[k]);
    return mag(result[0],result[1]); //mag(real,imag)
}

// More like a vertex buffer list to chunk through lists of signals
function listdft1D(signals,len) {
    var result = [0, 0];
    if (this.thread.x <= len) {
      result = DFT(signals,len,this.thread.x);
    } else {
      var n = Math.floor(this.thread.x/len);
      result = DFTlist(signals,len,this.thread.x-n*len,n);
    }

    return mag(result[0],result[1]);
}

function listdft1D_windowed(signals, sampleRate, freqStart, freqEnd) { //Will make a higher resolution DFT for a smaller frequency window.
    var result = [0, 0];
    if (this.thread.x <= sampleRate) {
      var freq = ( (this.thread.x/sampleRate) * ( freqEnd - freqStart ) ) + freqStart;
      result = DFT(signals,sampleRate,freq);
    } else {
      var n = Math.floor(this.thread.x/sampleRate);
      var freq = ( ( ( this.thread.x - n * sampleRate ) / sampleRate ) * ( freqEnd - freqStart ) ) + freqStart;
      result = DFTlist(signals,sampleRate,freq-n*sampleRate,n);
    }
    //var mags = mag(result[0],result[1]);

    return mag(result[0]*2,result[1]*2); //Multiply result by 2 since we are only getting the positive results and want to estimate the actual amplitudes (positive = half power, reflected in the negative axis)
}

//e.g. arrays = [[arr1],[arr2],[arr3],[arr4],[arr5],[arr6]], len = 10, n = 2, mod=1... return results of [arr1*arr2], [arr3*arr4], [arr5*arr6] as one long array that needs to be split
function bulkArrayMul(arrays, len, n, mod) {
    var i = n*Math.floor(this.thread.x/len); //Jump forward in array buffer
    var products = arrays[i][this.thread.x];
    for (var j = 0; j < n; j++) {
      products *= arrays[j][this.thread.x];
    }
    return products*mod;
}

export const createGpuKernels = {
    correlograms, dft, idft,
    listdft2D, listdft1D, listdft1D_windowed,
    bulkArrayMul, 
}
