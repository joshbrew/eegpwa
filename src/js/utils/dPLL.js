//Digital Phase-Locked Loop
//Joshua Brewster (MIT License)

//Based on https://liquidsdr.org/blog/pll-howto/ 
export function PLL(signal, freq) {
    //let phase_in = 3;
    let freq_in = 0.20;
    let n = signal.length;

    let α = 0.05;//Phase modulation scalar
    let ß = 0.5*α*α; //Frequency modulation scalar
    let phase_out = 0;
    let freq_out = 0;

    function cexp(real,imag) {
        let er = Math.exp(real);
        let re = er * Math.cos(imag);
        let im = er * Math.sin(imag);
        return [re,im];
    }

    function cmul(re1,im1,re2,im2) {
        let re = re1*re2 - im1*im2;
        let im = re1*im2 + im1*re2;
        return [re,im]; 
    }

    function conj(im){ //complex conjugate
        return -im;
    }

    function carg(re,im){ //complex argument, used for the phase error
        return Math.atan(im/re); //atan(imag/real);
    }

    function cmag(re,im){ //magnitude i.e. the amplitude of the wave at time t represented by real and imaginary components
        return Math.sqrt(re*re+im*im);
    }

    function ampToC(amplitude){
        return [amplitude,0]; //[real,imaginary]
    }

    let result={signal_in:signal,signal_out:new Array(signal.length).fill(0),phase_err:new Array(signal.length).fill(0)};
    for(let i=0; i<n; i++){ 
        let signal_in = ampToC(signal[i]); //original signal
        let signal_out = cexp(phase_out,0); //signal to mix

        let in_real = signal[i];
        let in_imag = 0;

        let sim_real = signal_out[0];
        let sim_imag = signal_out[1];

        let {mul_real,mul_imag} = cmul(in_real,in_imag,sim_real,conj(sim_imag)); //conjugate the simulated imaginary term

        let phase_err = carg(mul_real, mul_imag); //complex argument

        phase_out += α*phase_err; //change the phase by the error
        freq_out += ß*phase_err; //frequency changed by the error (?)

        phase_out += freq_out;

        result.signal_out[i]=cmag(sim_real,sim_imag);

        result.phase_err[i]=phase_err;

    }

    return result;
}  


//Written a little differently to be a bit more obvious
function dpll (signal_in, expectedFreq=2) {


    let α = 0.1;    //Phase modulation scalar
    let ß = .1;    //Frequency modulation scalar

    var phase_out = 0;
    var freq=expectedFreq,
        peakAmp=Math.max(...signal_in),
        floor=Math.min(...signal_in),
        fs=512;
    var sineWave = [];
    var t = 0;
    var increment = 1/fs; //x-axis time increment based on sample rate
    let phase_err = 0;
    var im = 0;

    for(var i = 0; i < signal_in.length; i++) {
        t=increment*i;
        
        var simulated = Math.sin(2*Math.PI*freq*t + phase_out); //Generate sine amplitude with the modulating parameters
        
        mag = Math.sqrt(simulated*simulated + im*im); //; convert re, im to polar (mag, phi)
        phi = Math.atan2(im, simulated);

        mag = mag * peakAmp;      //; apply factor `scale` to magnitude

        im = mag * Math.sin(phi);

        var cmulr = signal_in[i]*simulated; //throwing out the multiplication of the signal in imaginary number as we set it to 0
        var cmuli = signal_in[i]*im;
        if(cmulr === 0) { 
            phase_err = 0.0;
        } else { 
            phase_err = Math.atan(cmuli/cmulr);
        }

        phase_out += α*phase_err; //Correct parameters by the error
        freq += ß*phase_err;

        //console.log(simulated,phi,im,phase_err,phase_out,freq);

        sineWave.push(simulated);
    }

    return {estimated:sineWave,phase_err:phase_err,freq_est:freq,phase_est:phase_out};
}