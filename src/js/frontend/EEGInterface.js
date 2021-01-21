import {State} from './State'
import {eeg32, eegAtlas, eegmath} from '../utils/eeg32'
import {applyFilter, IIRNotchFilter, IIRLowPassFilter, DCBlocker} from '../utils/signal_analysis/IIRFilter'


let defaultTags = [
    {ch: 4, tag: "Fp2", viewing: true},
    {ch: 24, tag: "Fp1", viewing: true}
];


class channelFilterer { //Feed-forward IIR filters
    constructor(channel="A0",sps=512) {
        this.channel=channel; this.idx = 0; this.sps = sps;

        State.data.filtered[this.channel] = [];//Add placeholder to state

        this.notch50 = new IIRNotchFilter(sps,50,0.5);
        this.notch50_2 = new IIRNotchFilter(sps,50,0.5);
        this.notch50_3 = new IIRNotchFilter(sps,50,0.5);
        this.notch60 = new IIRNotchFilter(sps,60,0.5);
        this.notch60_2 = new IIRNotchFilter(sps,60,0.5);
        this.notch60_3 = new IIRNotchFilter(sps,60,0.5);
        this.lp1 = new IIRLowPassFilter(sps,50);
        this.lp2 = new IIRLowPassFilter(sps,50);
        this.lp3 = new IIRLowPassFilter(sps,50);
        this.dcb = new DCBlocker(0.995);
    }

    reset(sps=this.sps) {
        this.notch50 = new IIRNotchFilter(sps,50,0.5);
        this.notch50_2 = new IIRNotchFilter(sps,50,0.5);
        this.notch50_3 = new IIRNotchFilter(sps,50,0.5);
        this.notch60 = new IIRNotchFilter(sps,60,0.5);
        this.notch60_2 = new IIRNotchFilter(sps,60,0.5);
        this.notch60_3 = new IIRNotchFilter(sps,60,0.5);
        this.lp1 = new IIRLowPassFilter(sps,50);
        this.lp2 = new IIRLowPassFilter(sps,50);
        this.lp3 = new IIRLowPassFilter(sps,50);
        this.dcb = new DCBlocker(0.995);
    }

    apply(idx=this.lastidx+1) {
        let out=EEG.data[this.channel][idx]; 
        if(State.data.sma4 === true) {
            if(State.data.counter >= 4) { //Apply a 4-sample moving average
                out = (State.data.filtered[this.channel][idx-3] + State.data.filtered[this.channel][idx-2] + State.data.filtered[this.channel][idx-1] + out)*.25;
            }
            else if(EEG.data.counter >= 4){
                out = (EEG.data[this.channel][0] + EEG.data[this.channel][1] + EEG.data[this.channel][2] + out)*.25;
            }
        }
        if(State.data.dcblocker === true) { //Apply a DC blocking filter
            out = this.dcb.step(out);
        }
        if(State.data.notch50 === true) { //Apply a 50hz notch filter
            out = applyFilter(out,this.notch50);
            out = applyFilter(out,this.notch50_2);
            out = applyFilter(out,this.notch50_3);
        }
        if(State.data.notch60 === true) { //Apply a 60hz notch filter
            out = applyFilter(out,this.notch60);
            out = applyFilter(out,this.notch60_2);
            out = applyFilter(out,this.notch60_3);
        }
        if(State.data.lowpass50 === true) { //Apply 3 50Hz lowpass filters
            out = applyFilter(out,this.lp1);
            out = applyFilter(out,this.lp2);
            out = applyFilter(out,this.lp3);
        }
        this.lastidx=idx;
        return out;
    }
    
}

State.data.filterers = [];

defaultTags.forEach((row,i) => {
    State.data.filterers.push(new channelFilterer("A"+row.ch));
});






export const ATLAS = new eegAtlas(defaultTags);
export const EEG = new eeg32(
(newLinesInt) => { //on decoded
    if(State.data.useFilters === true) {
        if(EEG.data.counter !== EEG.maxBufferedSamples) {
            while(State.data.counter < EEG.data.counter){
                State.data.filterers.forEach((filterer,i) => {
                    let out = filterer.apply(State.data.counter);
                    State.data.filtered[filterer.channel].push(out);
                });
                State.data.counter++;
            }
        }
        else {
            for(let i = newLinesInt+1; i>1; i--){
                State.data.filterers.forEach((filterer,i) =>{
                    State.data.filtered[filterer.channel].shift();
                    let out = filterer.apply(State.data.counter-i);
                    State.data.filtered[filterer.channel].push(out);
                })
            }
        }
    }
    else {
        State.data.counter = EEG.data.counter;
    }
}, () => { //on connected
    State.setState({connected:true, rawFeed:true});
}, () => { //on disconnected
    State.setState({connected:false,rawFeed:false,analyze:false});
}); //onConnected callback to set state on front end.


//class EEGInterface { constructor () { } }

export const EEGInterfaceSetup = () => {
    //EEG interface setup

    let bandPassWindow = ATLAS.bandPassWindow(State.data.freqStart,State.data.freqEnd,EEG.sps)
    ATLAS.fftMap = ATLAS.makeAtlas10_20();
    ATLAS.coherenceMap = ATLAS.genCoherenceMap(ATLAS.channelTags);
    ATLAS.fftMap.shared.bandPassWindow = bandPassWindow;
    ATLAS.fftMap.shared.bandFreqs = ATLAS.getBandFreqs(bandPassWindow);
    ATLAS.coherenceMap.shared.bandPassWindow = bandPassWindow;
    ATLAS.coherenceMap.shared.bandFreqs = ATLAS.fftMap.shared.bandFreqs;

    window.receivedMsg = (msg) => { //Set worker message response
        //console.log("received!");
        if(msg.foo === "coherence"){
            var ffts = [...msg.output[1]];
            var coher = [...msg.output[2]];

            ATLAS.channelTags.forEach((row, i) => {
                if(row.tag !== null && i < EEG.nChannels){
                    //console.log(tag);
                    if(row.data.count > EEG.maxBufferedSamples) {
                        row.data.times.shift();
                        row.data.amplitudes.shift();
                        for(const prop in row.data.slices){
                            row.data.slices[prop].shift();
                            row.data.means[prop].shift();
                        }
                        row.data.count-=1;
                    }
                    ATLAS.mapFFTData(ffts, State.data.lastPostTime, i, row.tag);
                }
            });
            
            ATLAS.coherenceMap.map.forEach((row,i) => {
                if(row.data.count > EEG.maxBufferedSamples) {
                    row.data.times.shift();
                    row.data.amplitudes.shift();
                    for(const prop in row.data.slices){
                        row.data.slices[prop].shift();
                        row.data.means[prop].shift();
                    }
                    row.data.count-=1;
                }
            });
            
            ATLAS.mapCoherenceData(coher, State.data.lastPostTime);

            State.setState({FFTResult:ffts,coherenceResult:coher});

        }

        if(State.data.analyze === true) {
            runEEGWorker();
        }
        
    }

}

export const bufferEEGData = (taggedOnly=true) => {
    var buffer = [];
    var dat;
    for(var i = 0; i < ATLAS.channelTags.length; i++){
        if(i < EEG.nChannels) {
            if(taggedOnly===true) {
                if(ATLAS.channelTags[i].tag !== null && ATLAS.channelTags[i].tag !== 'other') {
                    var channel = "A"+ATLAS.channelTags[i].ch;       
                    if(State.data.useFilters === true) { dat = State.data.filtered[channel].slice(State.data.counter - EEG.sps, State.data.counter); }
                    else{ dat = EEG.data[channel].slice(EEG.data.counter - EEG.sps, EEG.data.counter); }
                    //console.log(channel);
                    buffer.push(dat);
                }
            }
            else{
                var channel = "A"+ATLAS.channelTags[i].ch;
                if(State.data.useFilters === true) { dat = EEG.data[channel].slice(State.data.counter - EEG.sps, State.data.counter); }
                else{ dat = EEG.data[channel].slice(EEG.data.counter - EEG.sps, EEG.data.counter); }
                //console.log(channel);
                buffer.push(dat);
            }
        }
    }
    return buffer;
}    

export const runEEGWorker = () => {

    var s = State.data;
    if(EEG.data.ms[EEG.data.counter-1] - s.lastPostTime < s.workerMaxSpeed) {
        setTimeout(()=>{runEEGWorker();}, s.workerMaxSpeed - (EEG.data.ms[EEG.data.counter-1] - s.lastPostTime) );
    }
    else{
        State.data.lastPostTime = EEG.data.ms[EEG.data.counter-1];
        if(s.fdBackMode === 'coherence') {
            //console.log("post to worker")
            var buf = bufferEEGData(true);
            var mins = [];
            buf.forEach((row,i) =>{
                var min = Math.min(...row) - 100; if (min < 0) { min = 0; }
                mins.push(min);
            });
            window.postToWorker({foo:'coherence', input:[buf, s.nSec, s.freqStart, s.freqEnd, EEG.uVperStep, mins]});
        }
    }
}

export const readyDataForWriting = () => {
    let header = [];
    let data = [];
    let mapidx = 0;
    for(let i = 0; i<EEG.data.counter; i++){
        line.push(EEG.data.ms[i]);
        ATLAS.channelTags.forEach((tag,j) => {
            let line=[];
            if(typeof tag.ch === "number"){
                line.push(EEG.data["A"+tag.ch]);
                if(i===0) {
                    header.push("A"+ch);
                }
            }
        });
        if(ATLAS.fftMap.map[0].times[mapidx] === EEG.data.ms[i]) {
            ATLAS.channelTags.forEach((tag,j) => {
                if(tag.tag !== null) {
                    let coord = ATLAS.getAtlasCoordByTag(tag.tag);
                    if(i===0) {
                        header.push(coord.tag,ATLAS.fftMap.shared.bandPassWindow.join(","));
                    }
                    line.push("fft:",coord.data.amplitudes[mapidx].join(","));
                }
            });
            ATLAS.coherenceMap.map.forEach((row,j) => {
                if(i===0){
                    header.push(row.tag,ATLAS.coherenceMap.shared.bandPassWindow.join(','));
                }
                line.push("coh:",row.data.amplitudes[mapidx]);
            });
            mapidx++;
        }
        data.push(line.join(",")+"\n");
    }

    return [header,data];
}

export const updateBandPass = (freqStart, freqEnd) => {
    var freq0 = freqStart; var freq1 = freqEnd;
    if (freq0 > freq1) {
        freq0 = 0;
    }
    if(freq1 > EEG.sps*0.5){
        freq1 = EEG.sps*0.5;
        State.data.freqEnd=freq1;
    }

    ATLAS.regenAtlasses(State.data.freqStart,State.data.freqEnd,EEG.sps);
}

export const updateChannelView = (input) => {
    var val = input; //s.channelView

    if(val.length === 0) { return; }

    var arr = val.split(",");
    ATLAS.channelTags.forEach((row,j) => { ATLAS.channelTags[j].viewing = false; });
    var newSeries = [{}];

    arr.forEach((item,i) => {
        var found = false;
        let getTags = ATLAS.channelTags.find((o, j) => {

        if((o.ch === parseInt(item)) || (o.tag === item)){
            //console.log(item);
            ATLAS.channelTags[j].viewing = true;
            found = true;
            return true;
        }
        });


        if (found === false){ //add tag
            if(!isNaN(parseInt(item))){
                ATLAS.channelTags.push({ch:parseInt(item), tag: null, viewing:true});
            }
            else {
                alert("Tag not assigned to channel: ", item);
            }
        }
    });

    //console.log(ATLAS.channelTags)
    var no_ffts_active = true; //Temp, am phasing out this option
    ATLAS.channelTags.forEach((o,i) => {
        if(o.viewing === true){
            if(o.tag !== null && o.tag !== 'other') {
                no_ffts_active = false;
            }
        }
    });
    if(no_ffts_active === true) {     
        ATLAS.channelTags.forEach((row,j) => { ATLAS.channelTags[j].viewing = true; });
    }

    if(State.data.fdBackMode === "coherence") {
        ATLAS.coherenceMap = ATLAS.genCoherenceMap(ATLAS.channelTags);
        ATLAS.coherenceMap.bandPasswindow = ATLAS.fftMap.shared.bandPassWindow;
        ATLAS.coherenceMap.shared.bandFreqs = ATLAS.fftMap.shared.bandFreqs;
        console.log(ATLAS.coherenceMap.map);
    }

}

export function updateChannelTags (input) {
    var val = input; //s.channelTags

    if(val.length === 0) { return; }
    //console.log(val);
    var arr = val.split(";");
    //console.log(arr);
    //channelTags.forEach((row,j) => { channelTags[j].viewing = false; });

    var atlasUpdated = false;
    arr.forEach((item,i) => {
        var dict = item.split(":");
        var found = false;
        let setTags = ATLAS.channelTags.find((o, j) => {
        if(o.ch === parseInt(dict[0])){
            if(dict[1] === "delete"){
                ATLAS.channelTags.splice(j,1);
                atlasUpdated = true;
            }
            else{
            let otherTags = ATLAS.channelTags.find((p,k) => {
                if(p.tag === dict[1]){
                    ATLAS.channelTags[k].tag = null;
                    atlasUpdated = true;
                    return true;
                }
            });

            //console.log(o);
            ATLAS.channelTags[j].tag = dict[1];
            ATLAS.channelTags[j].viewing = true;

            if(dict[2] !== undefined){
                var atlasfound = false;
                var searchatlas = ATLAS.fftMap.map.find((p,k) => {
                if(p.tag === dict[1]){
                    atlasfound = true;
                    return true;
                }
                });
                if(atlasfound !== true) {
                    var coords = dict[2].split(",");
                    if(coords.length === 3){
                        ATLAS.addToAtlas(dict[1],parseFloat(coords[0]),parseFloat(coords[1]),parseFloat(coords[2]))
                        atlasUpdated = true;
                    }
                }
            }
            }
            found = true;
            return true;
            }
        else if(o.tag === dict[1]){
            ATLAS.channelTags[j].tag = null; //Set tag to null since it's being assigned to another channel
            atlasUpdated = true;
        }
        });
        if (found === false){
        var ch = parseInt(dict[0]);
        if(!isNaN(ch)) {
            if((ch >= 0) && (ch < EEG.nChannels)){
                ATLAS.channelTags.push({ch:parseInt(ch), tag: dict[1], viewing: true});

            if(dict[2] !== undefined){
                var atlasfound = false;
                var searchatlas = ATLAS.fftMap.map.find((p,k) => {
                    if(p.tag === dict[1]){
                        atlasfound = true;
                        return true;
                    }
                });
                if(atlasfound !== true) {
                    var coords = dict[2].split(",");
                    if(coords.length === 3){
                        ATLAS.addToAtlas(dict[1],parseFloat(coords[0]),parseFloat(coords[1]),parseFloat(coords[2]))
                        atlasUpdated = true;
                    }
                }
            }
            }
        }
        }
    });

    if(atlasUpdated === true){
        ATLAS.regenAtlasses(State.data.freqStart,State.data.freqEnd,EEG.sps);
    }
    //setBrainMap();
    //setuPlot();
}


export const addChannelOptions = (selectId, taggedOnly=true, additionalOptions=[]) => {
    var select = document.getElementById(selectId);
    select.innerHTML = "";
    var opts = ``;
    ATLAS.channelTags.forEach((row,i) => {
    if(taggedOnly === true){
        if(row.tag !== null && row.tag !== 'other') {
            if(i === 0) {
                opts += `<option value='`+row.ch+`' selected='selected'>`+row.tag+`</option>`
              }
              else {
                opts += `<option value='`+row.ch+`'>`+row.tag+`</option>`
              }
        }
    }
    else{
      if(i === 0) {
        opts += `<option value='`+row.ch+`' selected='selected'>`+row.ch+`</option>`
      }
      else {
        opts += `<option value='`+row.ch+`'>`+row.ch+`</option>`
      }
    }
    });
    if(additionalOptions.length > 0) {
        additionalOptions.forEach((option,i) => {
            opts+=`<option value='`+option+`'>`+option+`</option>`
        });
    }
    select.innerHTML = opts;
  }

export const addCoherenceOptions = (selectId, additionalOptions=[]) => {
    var select = document.getElementById(selectId);
    select.innerHTML = "";
    var opts = ``;
    ATLAS.coherenceMap.map.forEach((row,i) => {
      if(i===0) {
        opts += `<option value='`+row.tag+`' selected="selected">`+row.tag+`</option>`;
      }
      else{
        opts += `<option value='`+row.tag+`'>`+row.tag+`</option>`;
      }
    });
    if(additionalOptions.length > 0) {
        additionalOptions.forEach((option,i) => {
            opts+=`<option value='`+option+`'>`+option+`</option>`
        });
    }
    select.innerHTML = opts;

  }

export function genBandviewSelect(id){
    return `
    <select id='`+id+`'>
      <option value="scp">SCP (0.1Hz-1Hz)</option>
      <option value="delta">Delta (1Hz-4Hz)</option>
      <option value="theta">Theta (4Hz-8Hz)</option>
      <option value="alpha1" selected="selected">Alpha1 (8Hz-10Hz)</option>
      <option value="alpha2">Alpha2 (10Hz-12Hz)</option>
      <option value="beta">Beta (12Hz-35Hz)</option>
      <option value="lowgamma">Low Gamma (35Hz-48Hz)</option>
      <option value="highgamma">High Gamma (48Hz+)</option>
    </select>`;
  }