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

function estimator(arr, mean, len) {
    var est = 0;
    var vari = 0;
    for (var i = 0; i < len; i++) {
        vari = arr[i]-mean;
        est += vari*vari;
    }
    return Math.sqrt(est);
}

function xcor(arr1, arr1mean, arr1Est, arr2buf, arr2mean, arr2Est, len, delay) {
    var correlation = 0;
    for (var i = 0; i < len; i++) {
        correlation += (arr1[i]-arr1mean)*(arr2buf[i+delay]-arr2mean);
    }
    return correlation/(arr1Est*arr2Est);
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

//Conjugated real and imaginary parts for iDFT
function iDFT(amplitudes, len, freq){ //inverse DFT to return time domain
    var real = 0;
    var imag = 0;
    var _len = 1/len;
    var shared = 6.28318530718*freq*_len;
    for(var i = 0; i<len; i++){
      var sharedi = shared*i; //this.thread.x is the target frequency
      real = real+amplitudes[i+(len-1)*n]*Math.cos(sharedi);
      imag = amplitudes[i+(len-1)*n]*Math.sin(sharedi)-imag;  
    }
    //var mag = Math.sqrt(real[k]*real[k]+imag[k]*imag[k]);
    return [real*_len,imag*_len]; //mag(real,imag)
}

function iDFTlist(amplitudes,len,freq,n){ //inverse DFT to return time domain 
    var real = 0;
    var imag = 0;
    var _len = 1/len;
    var shared = 6.28318530718*freq*_len
    for(var i = 0; i<len; i++){
      var sharedi = shared*i; //this.thread.x is the target frequency
      real = real+amplitudes[i+(len-1)*n]*Math.cos(sharedi);
      imag = amplitudes[i+(len-1)*n]*Math.sin(sharedi)-imag;  
    }
    //var mag = Math.sqrt(real[k]*real[k]+imag[k]*imag[k]);
    return [imag*_len,real*_len]; //mag(real,imag)
}

export const addGpuFunctions = [
    add, sub, mul, div, cadd, csub,
    cmul, cexp, mag, conj, lof, mean,
    estimator, xcor, DFTlist, DFT,
    iDFT, iDFTlist
];
