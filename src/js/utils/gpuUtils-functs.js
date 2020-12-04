
//------------------------------------
//---------GPU Utility Funcs---------- (gpu.addFunction())
//------------------------------------


function add(a, b) { return a + b; }
function sub(a, b) { return a - b; }
function mul(a, b) { return a * b; }
function div(a, b) { return a / b; }

function cadd(a_real, a_imag, b_real, b_imag) {
    return [a_real + b_real, a_imag + b_imag];
}

function csub(a_real, a_imag, b_real, b_imag) {
    return [a_real - b_real, a_imag - b_imag];
}

function cmul(a_real, a_imag, b_real, b_imag) {
    return [a_real*b_real - a_imag*b_imag, a_real*b_imag + a_imag*b_real];
}

function cexp(a_real, a_imag) {
    const er = Math.exp(a_real);
    return [er * Math.cos(a_imag), er * Math.sin(a_imag)];
}

function mag(a, b) { // Returns magnitude
    return Math.sqrt(a*a + b*b);
}

function conj(imag) { //Complex conjugate of x + iy is x - iy
    return 0 - imag;
}

function lof(n) { //Lowest odd factor
    const sqrt_n = Math.sqrt(n);
    var factor = 3;

    while(factor <= sqrt_n) {
        if (n % factor === 0) return factor;
        factor += 2;
    }
}

function mean(arr, len) {
    var mean = 0;
    for (var i = 0; i < len; i++) {
        mean += arr[i];
    }
    return mean/len;
}

function mse(arr, mean, len) { //mean squared error
    var est = 0;
    var vari = 0;
    for (var i = 0; i < len; i++) {
        vari = arr[i]-mean;
        est += vari*vari;
    }
    return est/len;
}

function rms(arr, mean, len) { //root mean square error
    var est = 0;
    var vari = 0;
    for (var i = 0; i < len; i++) {
        vari = arr[i]-mean;
        est += vari*vari;
    }
    return Math.sqrt(est/len);
}

function xcor(arr1, arr1mean, arr1Est, arr2buf, arr2mean, arr2Est, len, delay) { //performs a single pass of a cross correlation equation, see correlogramsKern
    var correlation = 0;
    for (var i = 0; i < len; i++) {
        correlation += (arr1[i]-arr1mean)*(arr2buf[i+delay]-arr2mean);
    }
    return correlation/(arr1Est*arr2Est);
}

function DFT(signal, len, freq){ //Extract a particular frequency
    var real = 0;
    var imag = 0;
    var _len = 1/len;
    var shared = 6.28318530718*freq*_len;

    for(var i = 0; i<len; i++){
      var sharedi = shared*i; //this.thread.x is the target frequency
      real = real+signal[i]*Math.cos(sharedi);
      imag = imag-signal[i]*Math.sin(sharedi);
    }
    //var mag = Math.sqrt(real[k]*real[k]+imag[k]*imag[k]);
    return [real*_len,imag*_len]; //mag(real,imag)
}

function DFTlist(signals, len, freq, n) { //Extract a particular frequency
    var real = 0;
    var imag = 0;
    var _len = 1/len;
    var shared = 6.28318530718*freq*_len;
    for(var i = 0; i<len; i++){
      var sharedi = shared*i; //this.thread.x is the target frequency
      real = real+signals[i+(len-1)*n]*Math.cos(sharedi);
      imag = imag-signals[i+(len-1)*n]*Math.sin(sharedi);  
    }
    //var mag = Math.sqrt(real[k]*real[k]+imag[k]*imag[k]);
    return [real*_len,imag*_len]; //mag(real,imag)
}

//FFT, simply implements a nyquist frequency based index skip for frequencies <= sampleRate*.25
function FFT(signal, len, freq, sr){ //Extract a particular frequency
    var real = 0;
    var imag = 0;
    var _len = 1/len;
    var shared = 6.28318530718*freq*_len;

    var skip = 1;
    var N = 0;
    var factor = sr*.25;
    if(freq <= factor){
        while(freq <= factor){
            factor=factor*.5;
            skip+=1;
        }
    }

    for(var i = 0; i<len; i+=skip){
      var j = i;
      if(j > len) { j = len; }
      var sharedi = shared*j; //this.thread.x is the target frequency
      real = real+signal[j]*Math.cos(sharedi);
      imag = imag-signal[j]*Math.sin(sharedi);
      N += 1;
    }
    //var mag = Math.sqrt(real[k]*real[k]+imag[k]*imag[k]);
    return [real/N,imag/N]; //mag(real,imag)
}

//Conjugated real and imaginary parts for iDFT (need to test still)
function iDFT(amplitudes, len, freq){ //inverse DFT to return time domain
    var real = 0;
    var imag = 0;
    var _len = 1/len;
    var shared = 6.28318530718*freq*_len;

    for(var i = 0; i<len; i++){
      var sharedi = shared*i; //this.thread.x is the target frequency
      real = real+amplitudes[i]*Math.cos(sharedi);
      imag = amplitudes[i]*Math.sin(sharedi)-imag;  
    }
    //var mag = Math.sqrt(real[k]*real[k]+imag[k]*imag[k]);
    return [real*_len,imag*_len]; //mag(real,imag)
}

function iDFTlist(amplitudes,len,freq,n){ //inverse DFT to return time domain 
    var real = 0;
    var imag = 0;
    var _len = 1/len;
    var shared = 6.28318530718*freq*_len
    for (var i = 0; i<len; i++) {
      var sharedi = shared*i; //this.thread.x is the target frequency
      real = real+amplitudes[i+(len-1)*n]*Math.cos(sharedi);
      imag = amplitudes[i+(len-1)*n]*Math.sin(sharedi)-imag;  
    }
    //var mag = Math.sqrt(real[k]*real[k]+imag[k]*imag[k]);
    return [real*_len,imag*_len]; //mag(real,imag)
}

function iFFT(amplitudes, len, freq, sr){ //inverse FFT to return time domain
    var real = 0;
    var imag = 0;
    var _len = 1/len;
    var shared = 6.28318530718*freq*_len;

    var skip = 1;
    var N = 0;
    var factor = sr*.25;
    if(freq <= factor){
        while(freq <= factor){
            factor=factor*.5;
            skip+=1;
        }
    }

    for(var i = 0; i<len; i+=skip){
      var j = i;
      if(j > len) { j = len; }
      var sharedi = shared*j; //this.thread.x is the target frequency
      real = real+amplitudes[j]*Math.cos(sharedi);
      imag = amplitudes[j]*Math.sin(sharedi)-imag;  
      N += 1;
    }
    //var mag = Math.sqrt(real[k]*real[k]+imag[k]*imag[k]);
    return [real/N,imag/N]; //mag(real,imag)
}





//------------------------------------
//---------Kernel functions----------- (gpu.createKernel(func))
//------------------------------------


function correlogramsKern(arrays, means, estimators, n, len) {

    var result;
    var j = Math.floor(this.thread.x / len);
    

    return this.thread.x;
}

//Return frequency domain based on DFT
function dftKern(signal, len, scalar) {
    var result = DFT(signal,len, this.thread.x);
    return mag(result[0], result[1])*scalar;
}

function idftKern(amplitudes, len, scalar) {
    var result = iDFT(amplitudes, len, this.thread.x);
    return mag(result[0], result[1])*scalar;
}

function fftKern(signal, len, scalar, sampleRate) {
    var result = FFT(signal,len, this.thread.x, sampleRate);
    return mag(result[0], result[1])*scalar;
}

function ifftKern(amplitudes, len, scalar, sampleRate) {
    var result = iFFT(amplitudes, len, this.thread.x, sampleRate);
    return mag(result[0], result[1])*scalar;
}

// Takes a 2D array input [signal1[],signal2[],signal3[]]; does not work atm
function listdft2DKern(signals, scalar) {
    var len = this.output.x;
    var result = DFT(signals[this.thread.y],len,this.thread.x);
    //var mag = Math.sqrt(real[k]*real[k]+imag[k]*imag[k]);
    return mag(result[0],result[1])*scalar; //mag(real,imag)
}

// More like a vertex buffer list to chunk through lists of signals
function listdft1DKern(signals,len, scalar) {
    var result = [0, 0];
    if (this.thread.x <= len) {
      result = DFT(signals,len,this.thread.x);
    } else {
      var n = Math.floor(this.thread.x/len);
      result = DFTlist(signals,len,this.thread.x-n*len,n);
    }

    return mag(result[0],result[1])*scalar;
}

function listdft1D_windowedKern(signals, sampleRate, freqStart, freqEnd, scalar) { //Will make a higher resolution DFT for a smaller frequency window.
    var result = [0, 0];
    if (this.thread.x <= sampleRate) {
      var freq = ( (this.thread.x/sampleRate) * ( freqEnd - freqStart ) ) + freqStart;
      result = DFT(signals,sampleRate,freq);
    } else {
      var n = Math.floor(this.thread.x/sampleRate);
      var freq = ( ( ( this.thread.x - n * sampleRate) / sampleRate ) * ( freqEnd - freqStart ) ) + freqStart;
      result = DFTlist(signals,sampleRate,freq-n*sampleRate,n);
    }
    //var mags = mag(result[0],result[1]);

    return mag(result[0]*2,result[1]*2)*scalar; //Multiply result by 2 since we are only getting the positive results and want to estimate the actual amplitudes (positive = half power, reflected in the negative axis)
}

//e.g. arrays = [[arr1],[arr2],[arr3],[arr4],[arr5],[arr6]], len = 10, n = 2, mod=1... return results of [arr1*arr2], [arr3*arr4], [arr5*arr6] as one long array that needs to be split
function bulkArrayMulKern(arrays, len, n, mod) {
    var i = n*Math.floor(this.thread.x/len); //Jump forward in array buffer
    var products = arrays[i][this.thread.x];
    for (var j = 0; j < n; j++) {
      products *= arrays[j][this.thread.x];
    }
    return products*mod;
}

export const createGpuKernels = {
    correlogramsKern, dftKern, idftKern,
    listdft2DKern, listdft1DKern, listdft1D_windowedKern,
    bulkArrayMulKern, fftKern, ifftKern,
}

export const addGpuFunctions = [
    add, sub, mul, div, cadd, csub,
    cmul, cexp, mag, conj, lof, mean,
    mse, rms, xcor, DFT, DFTlist,
    iDFT, iDFTlist, FFT, iFFT
];
