import {StateManager} from '../utils/StateManager'

//Initial state values
export const State = new StateManager(
    {
        applets:[],
        appletClasses:[],
        
        lastPostTime:0,
        FFTResult:[],
        coherenceResult:[],
        freqStart:0,
        freqEnd:100,
        nSec:1,
        nSecAdcGraph:10,
        fdBackMode: 'coherence',

        connected:false,
        analyze:false,
        rawFeed:true,

        workerMaxSpeed: 50
    }
);

