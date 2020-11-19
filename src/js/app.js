
import {eeg32, eegmath} from './eeg32.js'
import {SmoothieChartMaker, uPlotMaker, brainMap2D, BufferLoader, SoundJS, geolocateJS} from './eegvisuals.js'
import {GPU} from 'gpu.js'
import {gpuUtils} from './utils/gpuUtils.js'

if(!navigator.serial){
  document.getElementById("p").innerHTML = "navigator.serial not found! Enable #enable-experimental-web-platform-features in chrome://flags (search 'experimental') then refresh";
}

try { window.EEG = new eeg32(); }
catch (error) { alert("eeg32.js err: ", error) }

try { window.gpu = new gpuUtils(); }
catch (err) { alert("gpu.js utils error: ", err); }



var nChannels = 32; //Number of channels to sample
var sps = 512; //Samples per second
var nSec = 1; //Number of seconds to sample FFTs
var freqStart = 0; //Beginning of DFT frequencies
var freqEnd = 100; //End of DFT frequencies (max = SPS * 0.5, half the nyquist sampling rate)

var posFFTList = [];
var bandPassWindow = gpu.bandPassWindow(freqStart,freqEnd,sps); // frequencies (x-axis)

var coherenceResults = [bandPassWindow, bandPassWindow];

var graphmode = "FFT"; //"TimeSeries" "Coherence"
var fdbackmode = "coherence"; //"tg2o"
var sounds = null;//new SoundJS(); //For theta-gamma 2 octave

var nSecAdcGraph = 10; //number of seconds to show on the raw signal graph


EEG.channelTags = [
  {ch: 5, tag: "T3", viewing: true},
  {ch: 25, tag: "T4", viewing: true}
];

/*
{ch: 2, tag: "Fz"},  //Channel 2 etc.
{ch: 3, tag: "F3"},
{ch: 4, tag: "F4"},
{ch: 5, tag: "F7"},
{ch: 6, tag: "F8"},
{ch: 7, tag: "Cz"},
*/

EEG.atlas = EEG.makeAtlas10_20();

try {
var uplotter = new uPlotMaker("adc");
var uPlotData = [bandPassWindow,bandPassWindow,bandPassWindow];

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

//generalize this for the eeg32 class or just 
var channelBands = (channel,tag) => {
//console.time("slicing bands");
let atlasCoord = atlas.map.find((o, i) => {
  if(o.tag === tag){
  EEG.atlas.map[i].data.times.push(performance.now());
    EEG.atlas.map[i].data.amplitudes.push(posFFTList[channel]);
    var delta = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.delta[1][0], EEG.atlas.shared.bandFreqs.delta[1][EEG.atlas.shared.bandFreqs.delta[1].length-1]);
    EEG.atlas.map[i].data.slices.delta.push(delta);
    EEG.atlas.map[i].data.means.delta.push(mean(delta));
    var theta = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.theta[1][0], EEG.atlas.shared.bandFreqs.theta[1][EEG.atlas.shared.bandFreqs.theta[1].length-1]);
    EEG.atlas.map[i].data.slices.theta.push(theta);
    EEG.atlas.map[i].data.means.theta.push(mean(theta));
    var alpha = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.alpha[1][0], EEG.atlas.shared.bandFreqs.alpha[1][EEG.atlas.shared.bandFreqs.alpha[1].length-1]);
    EEG.atlas.map[i].data.slices.alpha.push(alpha);
    EEG.atlas.map[i].data.means.alpha.push(mean(alpha));
    var beta  = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.beta[1][0],  EEG.atlas.shared.bandFreqs.beta[1][EEG.atlas.shared.bandFreqs.beta[1].length-1]);
    EEG.atlas.map[i].data.slices.beta.push(beta);
    EEG.atlas.map[i].data.means.beta.push(mean(beta));
    var gamma = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.gamma[1][0], EEG.atlas.shared.bandFreqs.gamma[1][EEG.atlas.shared.bandFreqs.gamma[1].length-1]);
    EEG.atlas.map[i].data.slices.gamma.push(gamma);
    EEG.atlas.map[i].data.means.gamma.push(mean(gamma));
//console.timeEnd("slicing bands");
    return true;
  }
});
}



//---------------------------------------
//----------- UPDATE VISUALS ------------
//---------------------------------------

var updateVisuals = () => {

//uPlot
if(graphmode === "Stacked"){
  uplotter.makeStackeduPlot(undefined,uPlotData,undefined,channelTags);
}
else {
  uplotter.plot.setData(uPlotData);
}

//Smoothie charts
EEG.channelTags.forEach((row,i) => {
  var coord = EEG.getAtlasCoordByTag(row.tag);
  if(i===0) {
    smoothie1.bulkAppend([
      coord.data.delta[coord.data.delta.length-1],
      coord.data.theta[coord.data.theta.length-1],
      coord.data.alpha[coord.data.alpha.length-1],
      coord.data.beta[coord.data.beta.length-1],
      coord.data.gamma[coord.data.gamma.length-1]]);
  }
  if(i < smoothie2.series.length - 1){
    smoothie2.series[i].append(Date.now(), coord.data.alpha[coord.data.alpha.length-1]);
  }
});

//Brainmap
//normalize the point sizes to a max of 90.
var viewing = document.getElementById("bandview").value;
brainMap.updateHeatmapFromAtlas(EEG.atlas,EEG.channelTags,viewing);
}

var analyse = false;
var analyzeloop = null;



//---------------------------------------
//----------- PERFORM ANALYSIS ----------
//---------------------------------------


//Should do a lot of this with a worker to keep the UI smooth and prevent hangups
var analysisLoop = () => {
  if(analyse === true) {
      var buffer = [];
      for(var i = 0; i < EEG.channelTags.length; i++){
          if(i < nChannels) {
              var channel = "A"+EEG.channelTags[i].ch;
              var dat = EEG.data[channel].slice(EEG.data.counter - sps, EEG.data.counter);
              buffer.push(dat);
          }
      }
      if(fdbackmode === "coherence") {
          var correlograms = [];
          var xcorbuf = [];
          EEG.channelTags.forEach((row,i) => {
              var channel = "A"+row.ch;
              var dat = EEG.data[channel].slice(EEG.data.counter - sps, EEG.data.counter);
              xcorbuf.push(dat);
          });
          //Compare other channels to one channel to save time/processing. First result is an autocorrelation
          xcorbuf.forEach((buffer,i) => {
              correlograms.push(eegmath.crosscorrelation(xcorbuf[0],buffer));
          });
          //Then take FFTs of correlograms
          //var correlogram_FFTs = gpu.MultiChannelDFT_BandPass(xcor)[1];
          buffer.push(...correlograms);
          //Then use as a base multiplier on the original FFTs
      }

      console.time("GPU DFT");
      posFFTList = gpu.MultiChannelDFT_BandPass(buffer, nSec, freqStart, freqEnd)[1]; // Mass FFT
      console.timeEnd("GPU DFT");
      console.log("FFTs processed: ", buffer.length);

      if(fdbackmode === "coherence"){
          var correlogram_FFTs = posFFTList.splice(EEG.channelTags.length,EEG.channelTags.length); //Splice off the correlogram FFTs on the end
          //console.log(posFFTList);
          //console.log(correlogram_FFTs);
          var results = []; //Get a total product of all of the correlogram FFT arrays multiplied by all of the signal FFT arrays then check for coherence (resonance)
          correlogram_FFTs.forEach((fft,i) => {
              fft.forEach((elem,j) => {
                  if(i === 0){
                      results.push(posFFTList[i][j]*elem);
                  }
                  else{
                      results[j] *= (posFFTList[i][j]*elem);
                  }
              });
          });
          coherenceResults = [bandPassWindow, results];
      }

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
          var nsamples = Math.floor(sps*nSecAdcGraph);

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

        //Separate and report channel results by band
      channelTags.forEach((row,i) => {
          if((row.tag !== null) && (i < nChannels)){
              //console.log(tag);
              channelBands(i,row.tag);
          }
          if(row.tag === null){
              posFFTList.splice(i,0,null); //Add nulls to the magnitudes lists for the channelBands function to work
          }
      });
      atlas.shared.bandPassWindows.push(bandPassWindow);//Push the x-axis values for each frame captured as they may change


      //Update visuals

      updateVisuals();

      if(analyze === true) {setTimeout(() => {analyzeloop = requestAnimationFrame(analysisLoop);},200)};
      //console.log(coherenceResults);
  }
  
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
if(freq1 > sps*0.5){
  freq1 = sps*0.5;
}
freqStart = freq0;
freqEnd = freq1;
bandPassWindow = gpu.bandPassWindow(freq0,freq1,sps);

EEG.getBandFreqs(bandPassWindow); //Update bands accessed by the atlas for averaging
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
  uplotter.makeStackeduPlot(undefined, uPlotData, undefined, EEG.channelTags);
  
}

else if (graphmode === "TimeSeries") {
  graphmode = "Coherence";
  
  var newSeries = [{}];
  newSeries.push({
      label:"Coherence",
      value: (u, v) => v == null ? "-" : v.toFixed(1),
      stroke: "rgb("+Math.random()*255+","+Math.random()*255+","+Math.random()*255+")"
    });

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



    
