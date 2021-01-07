import {State} from './frontend/State'
import {UIManager} from './frontend/UIManager'
import {DOMFragment} from './utils/DOMFragment'
import {
    menu_template,
    menuheader_template,
    menudropdown_template,
    appletbox_template,
    menu_setup
} from './frontend/UItemplates'
import {AppletExample} from './applets/AppletExample'

import {eeg32, eegAtlas} from './utils/eeg32'

/*
//TODO: 
//UI Manager instantiates classes itself
//Port over all original features
//Deal with data saving and local storage
*/

//Add applets here that you want accessible (Follow Applet.js format!!!)
State.data.appletClasses.push(
    AppletExample
);


//EEG interface setup

var defaultTags = [
    {ch: 4, tag: "T3", viewing: true},
    {ch: 24, tag: "T4", viewing: true}
];

export const ATLAS = new eegAtlas(defaultTags);
export const EEG = new eeg32(undefined,() => {
    State.setState({connected:true, rawFeed: true});
}, () => {
    State.setState({connected:false, rawFeed: false, analyze: false});
}); //onConnected callback to set state on front end.

let bandPassWindow = ATLAS.bandPassWindow(State.data.freqStart,State.data.freqEnd,EEG.sps)

ATLAS.fftMap = ATLAS.makeAtlas10_20();
ATLAS.coherenceMap = ATLAS.genCoherenceMap(ATLAS.channelTags);
ATLAS.fftMap.shared.bandPassWindow = bandPassWindow;
ATLAS.fftMap.shared.bandFreqs = ATLAS.getBandFreqs(bandPassWindow);
ATLAS.coherenceMap.shared.bandPassWindow = bandPassWindow;
ATLAS.coherenceMap.shared.bandFreqs = ATLAS.fftMap.shared.bandFreqs;


function bufferEEGData() {
    var buffer = [];
    for(var i = 0; i < ATLAS.channelTags.length; i++){
        if(i < EEG.nChannels) {
            var channel = "A"+ATLAS.channelTags[i].ch;
            var dat = EEG.data[channel].slice(EEG.data.counter - EEG.sps, EEG.data.counter);
            buffer.push(dat);
        }
    }
    return buffer;

}

function updateBandPass(freqStart, freqEnd) {
    var freq0 = freqStart; var freq1 = freqEnd;
    if (freq0 > freq1) {
        freq0 = 0;
    }
    if(freq1 > EEG.sps*0.5){
        freq1 = EEG.sps*0.5;
        State.data.freqEnd=freq1;
    }

    ATLAS.fftMap = ATLAS.makeAtlas10_20(); //reset ATLAS

    let bandPassWindow = ATLAS.bandPassWindow(freq0,freq1,EEG.sps);

    ATLAS.fftMap.shared.bandPassWindow = bandPassWindow;//Push the x-axis values for each frame captured as they may change - should make this lighter
    ATLAS.fftMap.shared.bandFreqs = ATLAS.getBandFreqs(bandPassWindow); //Update bands accessed by the ATLAS for averaging

    if(State.data.fdBackMode === "coherence") {
        ATLAS.coherenceMap = ATLAS.genCoherenceMap(ATLAS.channelTags);
        ATLAS.coherenceMap.bandPasswindow = bandPassWindow;
        ATLAS.coherenceMap.shared.bandFreqs = ATLAS.fftMap.shared.bandFreqs;
    }
}

function updateChannelView(input) {
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
            if(parseInt(item) !== NaN){
                ATLAS.channelTags.push({ch:parseInt(item), tag: null, viewing:true});
            }
            else {
                alert("Tag not assigned to channel: ", item);
            }
          }
      });

}

function updateChannelTags (input) {
    var val = input; //s.channelTags

      if(val.length === 0) { return; }
      //console.log(val);
      var arr = val.split(";");
      //console.log(arr);
      //channelTags.forEach((row,j) => { channelTags[j].viewing = false; });
      //console.log(arr);
      arr.forEach((item,i) => {
        var dict = item.split(":");
        var found = false;
        let setTags = ATLAS.channelTags.find((o, j) => {
          if(o.ch === parseInt(dict[0])){
            if(dict[1] === "delete"){
                ATLAS.channelTags.splice(j,1);
            }
            else{
              let otherTags = ATLAS.channelTags.find((p,k) => {
                if(p.tag === dict[1]){
                    ATLAS.channelTags[k].tag = null;
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
                  }
                }
              }
            }
            found = true;
            return true;
            }
          else if(o.tag === dict[1]){
            ATLAS.channelTags[j].tag = null; //Set tag to null since it's being assigned to another channel
          }
        });
        if (found === false){
          var ch = parseInt(dict[0]);
          if(ch !== NaN) {
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
                  }
                }
              }
            }
          }
        }
      });

      ATLAS.coherenceMap = ATLAS.genCoherenceMap(ATLAS.channelTags); //Reset coherence map with new tags
      ATLAS.coherenceMap.shared.bandPassWindow = ATLAS.fftMap.shared.bandPassWindow;
      ATLAS.coherenceMap.shared.bandFreqs = ATLAS.fftMap.shared.bandFreqs;

      //setBrainMap();
      //setuPlot();
}

function runEEGWorker() {
    var s = State.getState();
    State.setState({lastPostTime: EEG.data.ms[EEG.data.ms.length-1]});
    if(s.fdBackMode === 'coherence') {
        console.log("post to worker")
        window.workers.postToWorker({foo:'coherence', input:[bufferEEGData(), s.nSec, s.freqStart, s.freqEnd, EEG.scalar]});
    }
}

window.receivedMsg = (msg) => { //Set worker message reponse
    console.log("received!");
    var ffts = [...msg.output[1]];
    var coher = [...msg.output[2]];

    State.setState(
        {
            FFTResult:ffts, 
            coherenceResult:coher
        }
    );

    EEG.channelTags.forEach((row, i) => {
        if(row.tag !== null && i < EEG.nChannels){
            //console.log(tag);
            ATLAS.mapFFTData(ffts, State.data.lastPostTime, i, row.tag);
          }
      });
  
    ATLAS.mapCoherenceData(coher, State.data.lastPostTime);
  
    if(State.data.analyze === true) {
        runEEGWorker();
    }
}












//UI Code

function deInitEEGui() {
    State.data.applets.forEach((applet,i) => {
        applet.deInit();
    })
    State.data.menunode.deleteNode()
    State.data.appletbox.deleteNode();
}

//Allows creating and destroying
function initEEGui() {
    State.data.menunode = new DOMFragment(menu_template,document.body);
    State.data.menuheader = new DOMFragment(menuheader_template,"menu_header");
    State.data.menudropdown = new DOMFragment(menudropdown_template,"menu_dropdown");
    State.data.appletbox = new DOMFragment(appletbox_template, document.body);
    menu_setup();

    document.getElementById("connect").onclick = () => {
        EEG.setupSerialAsync();
    }

    document.getElementById("run").onclick = () => {
        if(State.data.connected === true) {
            State.setState({analyze: true, rawFeed: true});
            runEEGWorker();
        }
        else{
            EEG.setupSerialAsync();
        }
    }

    document.getElementById("stop").onclick = () => {
        State.setState({analyze: false, rawFeed: false});
    }

    document.getElementById("setBandpass").onclick = () => {
        var freq0 = document.getElementById("freqStart").value;
        var freq1 = document.getElementById("freqEnd").value;
        State.data.freqStart = freq0; State.data.freqEnd = freq1;
        updateBandPass(freq0,freq1);
    }

    document.getElementById("setView").onclick = () => {
        var settings = document.getElementById("View").value;
        updateChannelView(settings);
    }

    document.getElementById("setTags").onclick = () => {
        var settings = document.getElementById("Tags").value;
        updateChannelTags(settings);
    }

    State.subscribe('connected', () => {
        if(State.data.connected === true) {document.getElementById("usbico").style.fill = "orange";}
        else { document.getElementById("usbico").style.fill = "black"; }
    });

}




const UI = new UIManager(initEEGui, deInitEEGui);
UI.responsiveUIUpdate();









/* //Mouse target debug
document.addEventListener('click', function(e) {
    e = e || window.event;
    var target = e.target || e.srcElement,
        text = target.textContent || target.innerText;   
    console.log(target)
}, false);
*/









