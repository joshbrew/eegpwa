//https://arachnoid.com/phase_locked_loop/resources/biquad_module.py
//Translated to JS by Josh Brewster
export class Biquad_Filter {
    constructor(type,freq,sps,Q=Math.sqrt(0.5),dbGain=0) {
      let types = ['lowpass','highpass','bandpass','notch','peak','lowshelf','highshelf'];
      if(types.indexOf(type) < 0) { 
        console.error("Valid types: 'lowpass','highpass','bandpass','notch','peak','lowshelf','highshelf'"); 
        return false; 
      }
      this.type = type;
  
      this.freq = freq;
      this.sps = sps;
      this.Q = Q;
      this.dbGain = dbGain;
  
      this.a0 = 0,this.a1 = 0,this.a2 = 0,
      this.b0 = 0,this.b1 = 0,this.b2 = 0;
  
      this.x1 = 0,this.x2 = 0,
      this.y1 = 0,this.y2 = 0;
  
      let A = Math.pow(10,dbGain/40);
      let omega = 2*Math.PI*freq/sps;
      let sn = Math.sin(omega)
      let cs = Math.cos(omega);
      let alpha = sn/(2*Q);
      let beta = Math.sqrt(A+A);
  
      this[type](A,sn,cs,alpha,beta);
  
      //scale constants
      this.b0 /= this.a0;
      this.b1 /= this.a0;
      this.b2 /= this.a0;
      this.a1 /= this.a0;
      this.a2 /= this.a0;
      
    }
  
    lowpass(A,sn,cs,alpha,beta) { //Stop upper frequencies
      this.b0 = (1-cs)*.5;
      this.b1 = 1-cs;
      this.b2 = (1-cs)*.5;
      this.a0 = 1+alpha;
      this.a1 = -2*cs;
      this.a2 = 1-alpha;
    }
  
    highpass(A,sn,cs,alpha,beta) { //Stop lower frequencies 
      this.b0 = (1+cs)*.5;
      this.b1 = -1-cs;
      this.b2 = (1+cs)*.5;
      this.a0 = 1 + alpha;
      this.a1 = -2*cs;
    }
  
    bandpass(A,sn,cs,alpha,beta) { //Stop lower and upper frequencies. Q = frequency_resonant / Bandwidth(to 3db cutoff line); frequency_resonant = Math.sqrt(f_low * f_high); So for 60Hz with 0.5Hz bandwidth: Fr = Math.sqrt(59.5*60.5). Q = Fr/0.5 = 120;
      this.b0 = alpha;
      this.b1 = 0;
      this.b2 = -alpha;
      this.a0 = 1+alpha;
      this.a1 = -2*cs;
      this.a2 = 1-alpha;
    }
  
    notch(A,sn,cs,alpha,beta) { //Stop a specific frequency
      this.b0 = 1;
      this.b1 = -2*cs;
      this.b2 = 1;
      this.a0 = 1+alpha;
      this.a1 = -2*cs;
      this.a2 = 1-alpha;
    }
  
    peak(A,sn,cs,alpha,beta) { //Opposite of a notch filter, stop all but one frequency
      this.b0 = 1+(alpha*A);
      this.b1 = -2*cs;
      this.b2 = 1-(alpha*A);
      this.a0 = 1+(alpha/A);
      this.a1 = -2*cs;
      this.a2 = 1-(alpha/A);
    }
  
    lowshelf(A,sn,cs,alpha,beta) { //Amplify signals below the cutoff
      this.b0 = A*((A+1) - (A-1)*cs + beta*sn);
      this.b1 = 2*A*((A-1)-(A+1)*cs);
      this.b2 = A*((A+1) - (A-1)*cs - beta*sn);
      this.a0 = (A+1) + (A+1)*cs + beta*sn;
      this.a1 = 2*((A-1) + (A+1)*cs);
      this.a2 = (A+1) + (A-1)*cs - beta*sn;
    }
  
    highshelf(A,sn,cs,alpha,beta) { //Amplify signals above the cutoff
      this.b0 = A*((A+1) + (A-1)*cs + beta*sn);
      this.b1 = 2*A*((A-1) + (A+1)*cs);
      this.b2 = A*((A+1) - (A-1)*cs - beta*sn);
      this.a0 = (A+1) - (A+1)*cs - beta*sn;
      this.a1 = 2*((A-1) - (A+1)*cs);
      this.a2 = (A+1) - (A-1)*cs - beta*sn;
    }
  
    applyFilter(signal_step) { //Step the filter forward, return modulated signal amplitude
      let y = this.b0*signal_step + this.b1*this.x1 + this.b2*this.x2 - this.a1*this.y1 - this.a2*this.y2;
      this.x2 = this.x1;
      this.x1 = signal_step;
      this.y2 = this.y1;
      this.y1 = y;
      
      return y;
    }
  
    zResult(freq) { //This should return the z-transfer function values. Max freq = sps/2
      try{
        let phi = Math.pow((Math.sin(Math.PI*freq*2/(2*this.sps))),2);
        let result = (Math.pow(this.b0+this.b1+this.b2,2) - 
                    4*(this.b0*this.b1+4*this.b0*this.b2 + this.b1*this.b2)*phi + 16*this.b0*this.b2*phi*phi) / 
                    (Math.pow(1+this.a1+this.a2,2) - 4*(this.a1 + 4*this.a2 + this.a1*this.a2)*phi + 16*this.a2*phi*phi)
        return result;
      } catch(err) {
        return -200;
      }
    }
  
    //Use for bandpass or peak filter
    static calcBandpassQ (frequency, bandwidth) { //Use Math.sqrt(0.5) for low pass, high pass, and shelf filters
        let Q = Math.sqrt((frequency-bandwidth)*(frequency+bandwidth))/bandwidth; //Could just do f/bw
        return Q;
    }

    static calcNotchQ (frequency, bandwidth) {
        let Q = bandwidth/Math.sqrt((frequency-bandwidth)*(frequency+bandwidth)); // bw/f
        return Q;
    }

  }
  

