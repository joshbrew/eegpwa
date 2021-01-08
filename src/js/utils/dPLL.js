//Digital Phase-Locked Loop
//Joshua Brewster (MIT License)

//Based on https://liquidsdr.org/blog/pll-howto/ 
export function PLL(signal, freq) {
    //let phase_in = 3;
    let freq_in = 0.20;
    let α = 0.05;
    let n = signal.length;

    let ß = 0.5*α*α;
    let phase_out = 0;
    let freq_out = 0;

    function cexp(real,imag) {
        let er = Math.exp(real);
        let re = er * Math.cos(imag);
        let im = er * Math.sin(imag);
        return [re,im];
    }

    function cmul(c1,c2) {
        let re = c1[0]*c2[0] - c1[1]*c2[1];
        let im = c1[0]*c2[1] + c1[0]*c2[0];
        return [re,im]; 
    }

    function conj(complexArr){
        complexArr[1] = -complexArr[1];
    }

    function carg(c){
        return Math.atan(c[1]/c[0]);
    }

    function cmag(c){
        return Math.sqrt(c[0]*c[0]+c[1]*c[1]);
    }

    function ampToC(amplitude){
        return [amplitude,0]; //[real,imaginary]
    }

    let result={signal_in:signal,signal_out:[],phase_err:[]};
    for(let i=0; i<n; i++){
        let signal_in = ampToC(signal[i]);
        let signal_out = cexp(phase_out,0);

        let phase_err = carg(cmul(signal_in,conj(signal_out)));

        phase_out += α*phase_err;
        freq_out += ß*phase_err;

        phase_out += freq_out;

        result.signal_out.push(cmag(signal_out));

        result.phase_err.push(phase_err);

    }

    return result;
}  