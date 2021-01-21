import {StateManager} from './StateManager'



//Initial state values
export const State = new StateManager(
    {
        applets:[],
        appletConfigs:[],
        appletsSpawned:0,
        maxApplets:4,
        appletClasses:[],
        
        counter:0,
        lastPostTime:0,
        FFTResult:[],
        coherenceResult:[],
        freqStart:1, //FFT constraints
        freqEnd:128,
        fftViewStart:0, //FFT indices to grab from
        fftViewEnd:255,
        nSec:1,
        nSecAdcGraph:10,
        fdBackMode: 'coherence',
        sessionName: '',

        connected:false,
        analyze:false,
        rawFeed:false,
        
        useFilters:true,
        notch50:true,
        notch60:true,
        lowpass50:true,
        dcblocker:true,
        sma4:true,
        filtered:{},

        workerMaxSpeed: 50
    }
);

