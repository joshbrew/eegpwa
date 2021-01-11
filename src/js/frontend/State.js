import {StateManager} from './StateManager'

//Initial state values
export const State = new StateManager(
    {
        applets:[],
        appletsSpawned:0,
        maxApplets:4,
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
        rawFeed:false,

        workerMaxSpeed: 25
    }
);

