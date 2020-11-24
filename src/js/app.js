import {eeg32, eegmath} from './eeg32.js'
import {SmoothieChartMaker, uPlotMaker, brainMap2D, BufferLoader, SoundJS, geolocateJS} from './eegvisuals.js'
import {GPU} from 'gpu.js'
import {gpuUtils} from './utils/gpuUtils.js'


if(!navigator.serial)
  console.error("navigator.serial not found! Enable #enable-experimental-web-platform-features in chrome://flags (search 'experimental') then refresh");//document.getElementById("p").innerHTML = "navigator.serial not found! Enable #enable-experimental-web-platform-features in chrome://flags (search 'experimental') then refresh";

try { window.EEG = new eeg32(); }
catch (error) { alert("eeg32.js err: ", error) }

var gfx = new GPU()

try { window.gpu = new gpuUtils(gfx); }
catch (err) { alert("gpu.js utils error: ", err); }


var nSec = 1; //Number of seconds to sample FFTs
var freqStart = 0; //Beginning of DFT frequencies
var freqEnd = 100; //End of DFT frequencies (max = SPS * 0.5, half the nyquist sampling rate)

var posFFTList = [];
var bandPassWindow = gpu.bandPassWindow(freqStart,freqEnd,EEG.sps); // frequencies (x-axis)
var analyze = false;

var coherenceResults = [bandPassWindow, bandPassWindow];

var graphmode = "FFT"; //"TimeSeries" "Coherence"
var fdbackmode = "coherence"; //"tg2o"
var sounds = null;//new SoundJS(); //For theta-gamma 2 octave

var nSecAdcGraph = 10; //number of seconds to show on the raw signal graph

var newMsg = true; //true if new message from worker

EEG.channelTags = [
  {ch: 5, tag: "T3", viewing: true},
  {ch: 10, tag: "Fp1", viewing: true},
  {ch: 15, tag: "Fp2", viewing: true},
  {ch: 25, tag: "T4", viewing: true},
];

EEG.atlas = EEG.makeAtlas10_20();

try {
  var uplotter = new uPlotMaker("adc");
  var uPlotData = [bandPassWindow];
  EEG.channelTags.forEach(() => {
    uPlotData.push(bandPassWindow)
  })

  uplotter.makeuPlot(uplotter.makeSeriesFromChannelTags(EEG.channelTags),uPlotData);
}
catch (err) {
  console.log("uPlot error: ", err);
}

try {
var smoothie1 = new SmoothieChartMaker(5,"smoothie1","rgb(125,0,0)");
var smoothie2 = new SmoothieChartMaker(8,"smoothie2","rgb(0,0,125)");
}
catch (err) {
console.log("Smoothiejs error: ", err);
}

//make brain map
try{
var brainMap = new brainMap2D("brainmap","brainmappoints");
brainMap.genHeatMap();
brainMap.points = [];
EEG.atlas.map.forEach((row,i) => {
  brainMap.points.push({x:row.data.x*1.5+200, y:200-row.data.y*1.5, size:130, intensity:0.8});
});
brainMap.updateHeatmap();
brainMap.updatePointsFromAtlas(EEG.atlas,EEG.channelTags);
}
catch (err) {
console.log("brainMap error: ", err);
}
//make analysis loop
EEG.atlas.shared.bandFreqs = EEG.getBandFreqs(bandPassWindow);

//generalize this for the eeg32 class
var channelBands = (channel,tag) => {
  //console.log(posFFTList[channel])
//console.time("slicing bands");
let atlasCoord = EEG.atlas.map.find((o, i) => {
  if(o.tag === tag){
  EEG.atlas.map[i].data.times.push(performance.now());
    EEG.atlas.map[i].data.amplitudes.push(posFFTList[channel]);
    var scp = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.scp[1][0], EEG.atlas.shared.bandFreqs.scp[1][EEG.atlas.shared.bandFreqs.scp[1].length-1]);
    EEG.atlas.map[i].data.slices.scp.push(scp);
    EEG.atlas.map[i].data.means.scp.push(eegmath.mean(scp));
    var delta = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.delta[1][0], EEG.atlas.shared.bandFreqs.delta[1][EEG.atlas.shared.bandFreqs.delta[1].length-1]);
    EEG.atlas.map[i].data.slices.delta.push(delta);
    EEG.atlas.map[i].data.means.delta.push(eegmath.mean(delta));
    var theta = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.theta[1][0], EEG.atlas.shared.bandFreqs.theta[1][EEG.atlas.shared.bandFreqs.theta[1].length-1]);
    EEG.atlas.map[i].data.slices.theta.push(theta);
    EEG.atlas.map[i].data.means.theta.push(eegmath.mean(theta));
    var alpha = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.alpha[1][0], EEG.atlas.shared.bandFreqs.alpha[1][EEG.atlas.shared.bandFreqs.alpha[1].length-1]);
    EEG.atlas.map[i].data.slices.alpha.push(alpha);
    EEG.atlas.map[i].data.means.alpha.push(eegmath.mean(alpha));
    var beta  = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.beta[1][0],  EEG.atlas.shared.bandFreqs.beta[1][EEG.atlas.shared.bandFreqs.beta[1].length-1]);
    EEG.atlas.map[i].data.slices.beta.push(beta);
    EEG.atlas.map[i].data.means.beta.push(eegmath.mean(beta));
    var gamma = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.gamma[1][0], EEG.atlas.shared.bandFreqs.gamma[1][EEG.atlas.shared.bandFreqs.gamma[1].length-1]);
    EEG.atlas.map[i].data.slices.gamma.push(gamma);
    EEG.atlas.map[i].data.means.gamma.push(eegmath.mean(gamma));
    
//console.timeEnd("slicing bands");
    return true;
  }
});
}

function coherence(data, nSec, freqStart, freqEnd) {
  const correlograms = eegmath.correlograms(data); 
  const buffer = [...data,...correlograms];
  const dfts = gpu.multiChannelDFT_Bandpass(buffer, nSec, freqStart, freqEnd);
  const cordfts = dfts[1].splice(data.length, dfts[1].length-data.length);
  
  const coherenceResults = []; 
  const nChannels = data.length;
  
  //cross-correlation dfts arranged like e.g. for 4 channels: [0:0, 0:1, 0:2, 0:3, 0:4, 1:1, 1:2, 1:3, 1:4, 2:2, 2:3, 2:4, 3:3, 3:4] etc.
  var k=0;
  cordfts.forEach((row,i) => { //move autocorrelation results to front to save brain power
    if (i == nChannels-k) {
    var temp = cordfts[i].splice(i,1);
    k++;
    cordfts[k].splice(k,0,temp);
    }
  });
  //Now arranged like [0:0,1:1,2:2,3:3,4:4,0:1,0:2,0:3,0:4,1:2,1:3,1:4,2:3,2:4,3:4]
  
  //For channels 0 and 1,
  //Multiply channel 0 DFT by channel 0 autocorrelation DFT
  //Multiply channel 1 DFT by channel 1 autocorrelation DFT
  //Multiply these two results together with the cross correlation DFT between channel 0 and 1.
  //Outputs FFT coherence data in order of channel data inputted e.g. for 4 channels resulting DFTs = [0:1,0:2,0:3,0:4,1:2,1:3,1:4,2:3,2:4,3:4];
  var autoFFTproducts = [];
  k = 0;
  var l = 0;
  cordfts.forEach((dft,i) => {
    var newdft = [];
    if(i < nChannels) { //first multiply autocorrelograms
    dft.forEach((amp,j) => {
      newdft.push(amp*dfts[i][j]);
    });
    autoFFTproducts.push(newdft);
    }
    else{ //now multiply cross correlograms
    l++;
    dft.forEach((amp,j) => {           
      newdft.push(amp*autoFFTproducts[k][j]*autoFFTproducts[k+l][j]);
    });
    
    if((l+k+1) === nChannels) {
      k++;
      l = 0;
    }
    coherenceResults.push(newdft);
    }
  });

  return [dfts[0],dfts[1],coherenceResults]
}

//---------------------------------------
//----------- UPDATE VISUALS ------------
//---------------------------------------

var updateVisuals = () => {

  
    //uPlot
    if(graphmode === "FFT"){

      //Animate plot(s)
      uPlotData = [
          bandPassWindow
      ];

      EEG.channelTags.forEach((row,i) => {
          if(row.viewing === true) {
              uPlotData.push(posFFTList[i]);
          }
      });

  }

  else if ((graphmode === "TimeSeries") || (graphmode === "Stacked")) {
      var nsamples = Math.floor(EEG.sps*nSecAdcGraph);

      uPlotData = [
          EEG.data.ms.slice(EEG.data.counter - nsamples, EEG.data.counter)
      ];

      EEG.channelTags.forEach((row,i) => {
          if(row.viewing === true) {
              uPlotData.push(EEG.data["A"+row.ch].slice(EEG.data.counter - nsamples, EEG.data.counter));
          }
      });
  }

  else if (graphmode === "Coherence") {
      uPlotData = coherenceResults;
  }

  //console.log(uPlotData)
  if(graphmode === "Stacked"){
    uplotter.makeStackeduPlot(undefined,uPlotData,undefined,channelTags);
  }
  else {
    uplotter.plot.setData(uPlotData);
  }

  //---------------------------------------------------------------

  //Smoothie charts
  EEG.channelTags.forEach((row,i) => {
    var coord = EEG.getAtlasCoordByTag(row.tag);
    if(i===0) {
      smoothie1.bulkAppend([
        coord.data.means.delta[coord.data.means.delta.length-1],
        coord.data.means.theta[coord.data.means.theta.length-1],
        coord.data.means.alpha[coord.data.means.alpha.length-1],
        coord.data.means.beta[coord.data.means.beta.length-1],
        coord.data.means.gamma[coord.data.means.gamma.length-1]]);
    }
    if(i < smoothie2.series.length - 1){
      smoothie2.series[i].append(Date.now(), coord.data.means.alpha[coord.data.means.alpha.length-1]);
    }
  });

  //-----------------------------------------------------------------

  //Brainmap
  //normalize the point sizes to a max of 90.
  var viewing = document.getElementById("bandview").value;
  brainMap.updateHeatmapFromAtlas(EEG.atlas,EEG.channelTags,viewing);


  //------------------------------------------------------------------
}



var analyzeloop = null;






//---------------------------------------
//----------- PERFORM ANALYSIS ----------
//---------------------------------------


//Should do a lot of this with a worker to keep the UI smooth and prevent hangups
var analysisLoop = () => {
  if((analyze === true) && (newMsg === true)) {
    //console.log("analyzing")
      var buffer = [];
      for(var i = 0; i < EEG.channelTags.length; i++){
          if(i < EEG.nChannels) {
              var channel = "A"+EEG.channelTags[i].ch;
              var dat = EEG.data[channel].slice(EEG.data.counter - sps, EEG.data.counter);
              buffer.push(dat);
          }
      }

      if(window.workers !== undefined){

        newMsg = false;
        if(fdbackmode === "coherence") {
          window.postToWorker("coherence",[buffer,nSec,freqStart,freqEnd]);
        }
        else {
          window.postToWorker("multidftbandpass",[buffer,nSec,freqStart,freqEnd]);
        }
        
      }
      else{

        if(fdbackmode === coherence) {
          console.time("GPU DFT + coherence")
          var results = coherence(buffer, nSec, freqStart, freqEnd);
          console.timeEnd("GPU DFT + coherence");
          console.log("FFTs processed: ", buffer.length+results[2].length);
          bandPassWindow = results[0];
          posFFTList = results[1];
          coherenceResults = results[2];
        }
        else {
          console.time("GPU DFT");
          posFFTList = gpu.MultiChannelDFT_Bandpass(buffer, nSec, freqStart, freqEnd)[1]; // Mass FFT
          console.timeEnd("GPU DFT");
          console.log("FFTs processed: ", buffer.length);
  
        }
        
        processFFTs();
        
        //Update visuals
        updateVisuals();
      }

      //console.log(coherenceResults);
  }
  if(analyze === true) {setTimeout(() => {analyzeloop = requestAnimationFrame(analysisLoop);},50)};
  
}





function processFFTs() {
    
      //Separate and report channel results by band
      EEG.channelTags.forEach((row,i) => {
          if((row.tag !== null) && (i < nChannels)){
              //console.log(tag);
              channelBands(i,row.tag);
          }        
      });
  
      EEG.atlas.shared.bandPassWindows.push(bandPassWindow);//Push the x-axis values for each frame captured as they may change - should make this lighter

}




//---------------------------------------
//-------------- UI SETUP ---------------
//---------------------------------------

document.getElementById("connect").onclick = () => {EEG.setupSerialAsync();}

document.getElementById("analyze").onclick = () => {
if(EEG.port !== null){
  if((analyzeloop === null) || (analyze === false)) {
    analyze = true;
    setTimeout(()=>{analyzeloop = requestAnimationFrame(analysisLoop)},200);
  } 
  else{alert("connect the EEG first!")}}
}

document.getElementById("stop").onclick = () => { cancelAnimationFrame(analyzeloop); analyze = false; }

document.getElementById("record").onclick = () => { alert("dummy"); }

document.getElementById("bandPass").onclick = () => {
  var freq0 = parseFloat(document.getElementById("freqStart").value);
  var freq1 = parseFloat(document.getElementById("freqEnd").value);
  if (freq0 > freq1) {
    freq0 = 0;
  }
  if(freq1 > EEG.sps*0.5){
    freq1 = EEG.sps*0.5;
  }
  freqStart = freq0;
  freqEnd = freq1;
  bandPassWindow = gpu.bandPassWindow(freq0,freq1,EEG.sps);

  EEG.getBandFreqs(bandPassWindow); //Update bands accessed by the atlas for averaging
}

document.getElementById("bandview").onchange = () => {
  var viewing = document.getElementById("bandview").value;
  brainMap.updateHeatmapFromAtlas(EEG.atlas,EEG.channelTags,viewing);
}

document.getElementById("mode").onclick = () => {
if(graphmode === "FFT"){
  graphmode = "TimeSeries";
  document.getElementById("uplottitle").innerHTML = "ADC signals";
  uplotter.plot.axes[0].values = (u, vals, space) => vals.map(v => +(v*0.001).toFixed(1) + "s");
}
else if (graphmode === "Stacked"){

  graphmode = "FFT";
  uplotter.makeuPlot(uplotter.makeSeriesFromChannelTags(EEG.channelTags), uPlotData);
  
}

else if (graphmode === "Coherence") {
  graphmode = "Stacked";
  document.getElementById("uplottitle").innerHTML = "ADC signals Stacked";
  
  console.log(uPlotData)
  uplotter.makeStackeduPlot(undefined, uPlotData, undefined, EEG.channelTags);
  
}

else if (graphmode === "TimeSeries") {
  graphmode = "Coherence";
  
  var newSeries = [{}];

  var l = 0;
  var k = 0;
  
  coherenceResults.forEach((row,i) => {
    l++;
    newSeries.push({
      label:"A"+EEG.channelTags[k].ch+":A"+EEG.channelTags[k+l].ch,
      value: (u, v) => v == null ? "-" : v.toFixed(1),
      stroke: "rgb("+Math.random()*255+","+Math.random()*255+","+Math.random()*255+")"
    });
    if(l+k+1 === EEG.channelTags.length){
      k++;
      l=0;
    }
  })

  uplotter.makeuPlot(newSeries, coherenceResults);

  document.getElementById("uplottitle").innerHTML = "Coherence from selected signals";

}

}



document.getElementById("tg2o").onclick = () => {
  sounds = new SoundJS();

//setup tg2o visuals
}



document.getElementById("setChannelView").onclick = () => {
var val = document.getElementById("channelView").value;
if(val.length === 0) { return; }
var arr = val.split(",");
EEG.channelTags.forEach((row,j) => { EEG.channelTags[j].viewing = false; });
var newSeries = [{}];
arr.forEach((item,i) => {
  var found = false;
  let getTags = EEG.channelTags.find((o, j) => {

  if((o.ch === parseInt(item)) || (o.tag === item)){
    //console.log(item);
    EEG.channelTags[j].viewing = true;
    newSeries.push({
      label:"A"+o.ch + ", Tag: "+o.tag,
      value: (u, v) => v == null ? "-" : v.toFixed(1),
      stroke: "rgb("+Math.random()*255+","+Math.random()*255+","+Math.random()*255+")"
    });
    found = true;
    return true;
    }
  });


  if (found === false){ //add tag
    if(parseInt(item) !== NaN){
      EEG.channelTags.push({ch:parseInt(item), tag: null, viewing:true});
      newSeries.push({
        label:"A"+parseInt(item) + ", Tag:" + null,
        value: (u, v) => v == null ? "-" : v.toFixed(1),
        stroke: "rgb("+Math.random()*255+","+Math.random()*255+","+Math.random()*255+")"
      });
    }
    else {
      alert("Tag not assigned to channel: ", item);
    }
  }
});

if(uPlotData.length - 1 < EEG.channelTags.length) {
  while (uPlotData.length - 1 < EEG.channelTags.length) {
    uPlotData.push(bandPassWindow);
  }
}

if((graphmode !== "Coherence") || (graphmode !== "Stacked")){
  console.time("makeplot");
  uplotter.makeuPlot(uplotter.makeSeriesFromChannelTags(EEG.channelTags), uPlotData);
  console.timeEnd("makeplot");
}
if(graphmode === "Stacked"){
  uplotter.makeStackeduPlot(undefined, uPlotData, undefined, EEG.channelTags);
}
}



document.getElementById("setTags").onclick = () => {
  var val = document.getElementById("channelTags").value;
  if(val.length === 0) { return; }
  //console.log(val);
  var arr = val.split(",");
  console.log(arr);
  //channelTags.forEach((row,j) => { channelTags[j].viewing = false; });
  //console.log(arr);
  arr.forEach((item,i) => {
    var dict = item.split(":");
    var found = false;
    let setTags = EEG.channelTags.find((o, j) => {
      if(o.ch === parseInt(dict[0])){
        let otherTags = EEG.channelTags.find((p,k) => {
          if(p.tag === dict[1]){
            EEG.channelTags[k].tag = null;
            return true;
          }
        })
        //console.log(o);
        EEG.channelTags[j].tag = dict[1];
        EEG.channelTags[j].viewing = true;
        found = true;
        return true;
        }
      else if(o.tag === dict[1]){
        EEG.channelTags[j].tag = null; //Set tag to null since it's being assigned to another channel
      }
    });
    if (found === false){
      var ch = parseInt(dict[0]);
      if(ch !== NaN) {
        if((ch >= 0) && (ch < nChannels)){
          EEG.channelTags.push({ch:parseInt(ch), tag: dict[1], viewing: true});
        }
      }
    }
  });

  if(uPlotData.length - 1 < EEG.channelTags.length) {
    while (uPlotData.length - 1 < EEG.channelTags.length) {
      uPlotData.push(bandPassWindow);
    }
  }

  //var newSeries = [{}]//plot.series;
  brainMap.updatePoints(EEG.atlas,EEG.channelTags);

  if((graphmode !== "Coherence") || (graphmode !== "Stacked")){
      console.time("makeplot");
      uplotter.makeuPlot(uplotter.makeSeriesFromChannelTags(EEG.channelTags), uPlotData);
      console.timeEnd("makeplot");
    }
  if(graphmode === "Stacked"){
    uplotter.makeStackeduPlot(undefined, uPlotData, undefined, EEG.channelTags);
  }
}



//-------------------------------------------
//----------------Worker stuff---------------
//-------------------------------------------


//For handling worker messages
window.receivedMsg = (msg) => {
  if(msg.foo === "multidftbandpass") {
    //console.log(msg)
    posFFTList = [...msg.output[1]];
    processFFTs();
    updateVisuals();
    newMsg = true;
  }
  if(msg.foo === "coherence") {
    posFFTList = [...msg.output[1]];
    coherenceResults = [...msg.output[2]];
    processFFTs();
    updateVisuals();
  }
}


var sine = eegmath.genSineWave(10,1,1,512);
var bigarr = new Array(8).fill(sine[1]);

//console.log(sine)
function testGPU(){
  console.log("testGPU()");
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd]);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd]);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd]);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd]);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd]);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd]);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd]);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd]);
  console.log("posted 128x dft 8 times");
}

  setTimeout(()=>{testGPU()},1000); //Need to delay this call since app.js is made before the worker script is made




    
