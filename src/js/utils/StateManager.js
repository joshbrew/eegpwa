import {ObjectListener} from './ObjectListener'

//Simple state manager.
//Set key responses to have functions fire when keyed values change
//add variables to state with addToState(key, value, keyonchange (optional))
export class StateManager {
    constructor(init = {},interval="FRAMERATE") { //Default interval is at the browser framerate
        this.data = init;
        this.data["stateUpdateInterval"] = interval;
        this.prev = JSON.parse(JSON.stringifyWithCircularRefs(this.data));
        this.listener = new ObjectListener();

        this.pushToState={};

        /* //This keeps running for some reason.
        this.listener.addListener(
            "state",
            this.data,
            null,
            () => {
                this.listener.listeners.forEach((obj,i) => {
                    this.prev=JSON.parse(JSON.stringifyWithCircularRefs(this.data));
                });
            },
            interval
        );

        */

        this.listener.addListener(
            "interval",
            this.data,
            "stateUpdateInterval",
            () => {
                this.listener.listeners.forEach((obj,i) => {
                    obj.interval = this.data["stateUpdateInterval"];
                });
            },
            interval
        );

        this.listener.addListener(
            "push",
            this,
            "pushToState",
            () => {
                if(this.pushToState !== {}){
                    this.prev=JSON.parse(JSON.stringifyWithCircularRefs(this.data));
                    //console.log(this.prev);
                    Object.keys(this.pushToState).forEach((key,i) =>{
                        if(this.data[key] === undefined) {
                            this.addToState(key, this.pushToState[key])
                        }
                        else{
                            this.data[key] = this.pushToState[key];
                        }
                    });
                    this.pushToState = {};
                }
            },
            interval
        );

    }

    //Alternatively just add to the state by doing this.state[key] = value with the state manager instance
    addToState(key, value, setPrimaryKeyResponse=null) {
        this.data[key] = value;
        if(setPrimaryKeyResponse !== null){
            this.setPrimaryKeyResponse(key,setPrimaryKeyResponse);
        }
    }

    getState() { //Return a copy of the latest state
        return JSON.parse(JSON.stringifyWithCircularRefs(this.data));
    }

    setState(updateObj={}){ //Pass object with keys in. Undefined keys in state will be added automatically. State only notifies of change based on update interval
        this.pushToState = updateObj;
    }

    //Set main onchange response for the property-specific object listener. Don't touch the state
    setPrimaryKeyResponse(key=null, onchange=null) {
        if(onchange !== null){
            if(this.listener.hasKey(key)){
                this.listener.onchange(key, onchange);
            }
            else if(key !== null){
                this.listener.addListener(key,this.data,key,onchange,this.data["stateUpdateInterval"]);
            }

        }
    }

    //Add extra onchange responses to the object listener for a set property. Use state key for state-wide change responses
    addSecondaryKeyResponse(key=null, onchange=null) {
        if(onchange !== null){
            if(this.listener.hasKey(key)){
                return this.listener.addFunc(key, onchange);
            }
            else if(key !== null){
                this.listener.addListener(key,this.data,key,()=>{},this.data["stateUpdateInterval"]);
                return this.listener.addFunc(key, onchange);
            }
            else { return this.listener.addFunc("state", onchange);}
        }
    }

    //removes all secondary responses if idx left null. use "state" key for state-wide change responses
    removeSecondaryKeyResponse(key=null,responseIdx=null) {
        if(key !== null) {
            if(this.listener.hasKey(key)){
                this.listener.removeFuncs(key, responseIdx);
            }
        }
        else{console.error("provide key")}
    }

    //Remove any extra object listeners for a key. Entering "state" will break the state manager's primary response
    clearAllKeyResponses(key=null) {
        this.listener.remove(key);
    }

    //Save the return value to provide as the responseIdx in unsubscribe
    subscribe(key, onchange) {
        return this.addSecondaryKeyResponse(key,onchange);
    }

    //Unsubscribe from the given key using the index of the response saved from the subscribe() function
    unsubscribe(key, responseIdx=null) {
        this.removeSecondaryKeyResponse(key, responseIdx);
    }

    unsubscribeAll(key) {
        this.clearAllKeyResponses(key);
    }

}
