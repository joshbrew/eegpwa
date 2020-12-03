import {eeg32, eegmath} from './eeg32.js'
import {SmoothieChartMaker, uPlotMaker, TimeChartMaker, Spectrogram, mirrorBarChart, eegBarChart, brainMap2D, BufferLoader, SoundJS, geolocateJS} from './eegvisuals.js'
import {GPU} from 'gpu.js'
import {gpuUtils} from './utils/gpuUtils.js'


if(!navigator.serial)
  console.error("navigator.serial not found! Enable #enable-experimental-web-platform-features in chrome://flags (search 'experimental') then refresh");//document.getElementById("p").innerHTML = "navigator.serial not found! Enable #enable-experimental-web-platform-features in chrome://flags (search 'experimental') then refresh";

try { window.EEG = new eeg32(); }
catch (error) { alert("eeg32.js err: ", error) }

var gfx = new GPU();

try { window.gpu = new gpuUtils(gfx); }
catch (err) { alert("gpu.js utils error: ", err); }


var session = {
  nSec: 1,
  freqStart: 0,
  freqEnd: 100,
  posFFTList: [],
  coherenceResults: [],
  bandPassWindow: [],
  nSecAdcGraph: 10,
  fdbackmode: "coherence",
  newMsg: true,
  vscale: EEG.vref*EEG.stepSize,
  stepsPeruV: 0.000001 / vscale,
  analyze: false,
  analyzeloop: null,
  rawfeed: false,
  rawfeedloop: null,
}


var nSec = 1; //Number of seconds to sample FFTs
var freqStart = 0; //Beginning of DFT frequencies
var freqEnd = 100; //End of DFT frequencies (max = SPS * 0.5, half the nyquist sampling rate)

var posFFTList = [];
var bandPassWindow = gpu.bandPassWindow(freqStart,freqEnd,EEG.sps); // frequencies (x-axis)

var coherenceResults = [];

var graphmode = "FFT"; //"TimeSeries", "Stacked", "Coherence"
var fdbackmode = "coherence"; //"tg2o"
var channelView = 0;

var sounds = null;//new SoundJS(); //For theta-gamma 2 octave

var nSecAdcGraph = 10; //number of seconds to show on the raw signal graph

var newMsg = true; //true if new message from worker
var anim = null;

var vscale = EEG.vref*EEG.stepSize; //ADC to volts
var stepsPeruV = 0.000001 / vscale; //steps per microvolt

var analyzeloop = null;
var feedloop = null;
var analyze = false;
var feed = false;

EEG.channelTags = [
  {ch: 5, tag: "T3", viewing: true},
  {ch: 25, tag: "T4", viewing: true}
];

EEG.atlas = EEG.makeAtlas10_20();
EEG.coherenceMap = EEG.genCoherenceMap(EEG.channelTags);
EEG.atlas.shared.bandPassWindow = bandPassWindow;
EEG.atlas.shared.bandFreqs = EEG.getBandFreqs(bandPassWindow);
EEG.coherenceMap.shared.bandPassWindow = bandPassWindow;
EEG.coherenceMap.shared.bandFreqs = EEG.atlas.shared.bandFreqs;

try {
  window.uplotter = new uPlotMaker("adc");
  window.uPlotData = [bandPassWindow];
  EEG.channelTags.forEach(() => {
    uPlotData.push(bandPassWindow)
  })

  uplotter.makeuPlot(uplotter.makeSeriesFromChannelTags(EEG.channelTags),uPlotData);
}
catch (err) {
  console.log("uPlot error: ", err);
}

try {
  window.Smoothie1 = new SmoothieChartMaker(5,"smoothie1","rgb(125,0,0)");
  window.Smoothie2 = new SmoothieChartMaker(8,"smoothie2","rgb(0,0,125)");
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

//appendId is the element Id you want to append this fragment to
function appendFragment(HTMLtoAppend, parentId) {

  var fragment = document.createDocumentFragment();
  var newDiv = document.createElement('div');
  newDiv.insertAdjacentHTML('afterbegin',HTMLtoAppend);
  newDiv.setAttribute("id", parentId + '_child');

  fragment.appendChild(newDiv);

  document.getElementById(parentId).appendChild(fragment);
}

//delete selected fragment. Will delete the most recent fragment if Ids are shared.
function deleteFragment(parentId,fragmentId) {
  var this_fragment = document.getElementById(fragmentId);
  document.getElementById(parentId).removeChild(this_fragment);
}

//Remove Element Parent By Element Id (for those pesky anonymous child fragment containers)
function removeParent(elementId) {
  // Removes an element from the document
  var element = document.getElementById(elementId);
  element.parentNode.parentNode.removeChild(element.parentNode);
}


//generalize this for the eeg32 class
var channelBands = (channel,tag) => {
  //console.log(posFFTList[channel])
  //console.time("slicing bands");
  let atlasCoord = EEG.atlas.map.find((o, i) => {
    if(o.tag === tag){
      EEG.atlas.map[i].data.times.push(performance.now());
      EEG.atlas.map[i].data.amplitudes.push(posFFTList[channel]);
      if(EEG.atlas.shared.bandFreqs.scp[1].length > 0){
        var scp = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.scp[1][0], EEG.atlas.shared.bandFreqs.scp[1][EEG.atlas.shared.bandFreqs.scp[1].length-1]+1);
        EEG.atlas.map[i].data.slices.scp.push(scp);
        EEG.atlas.map[i].data.means.scp.push(eegmath.mean(scp));
      }
      if(EEG.atlas.shared.bandFreqs.scp[1].length > 0){
        var delta = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.delta[1][0], EEG.atlas.shared.bandFreqs.delta[1][EEG.atlas.shared.bandFreqs.delta[1].length-1]+1);
        EEG.atlas.map[i].data.slices.delta.push(delta);
        EEG.atlas.map[i].data.means.delta.push(eegmath.mean(delta));
      }
      if(EEG.atlas.shared.bandFreqs.theta[1].length > 0){
        var theta = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.theta[1][0], EEG.atlas.shared.bandFreqs.theta[1][EEG.atlas.shared.bandFreqs.theta[1].length-1]+1);
        EEG.atlas.map[i].data.slices.theta.push(theta);
        EEG.atlas.map[i].data.means.theta.push(eegmath.mean(theta));
      }
      if(EEG.atlas.shared.bandFreqs.alpha[1].length > 0){
        var alpha = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.alpha[1][0], EEG.atlas.shared.bandFreqs.alpha[1][EEG.atlas.shared.bandFreqs.alpha[1].length-1]+1);
        EEG.atlas.map[i].data.slices.alpha.push(alpha);
        EEG.atlas.map[i].data.means.alpha.push(eegmath.mean(alpha));
      }
      if(EEG.atlas.shared.bandFreqs.beta[1].length > 0){
        var beta  = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.beta[1][0],  EEG.atlas.shared.bandFreqs.beta[1][EEG.atlas.shared.bandFreqs.beta[1].length-1]+1);
        EEG.atlas.map[i].data.slices.beta.push(beta);
        EEG.atlas.map[i].data.means.beta.push(eegmath.mean(beta));
      }
      if(EEG.atlas.shared.bandFreqs.lowgamma[1].length > 0){ 
        var lowgamma = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.lowgamma[1][0], EEG.atlas.shared.bandFreqs.lowgamma[1][EEG.atlas.shared.bandFreqs.lowgamma[1].length-1]+1);
        EEG.atlas.map[i].data.slices.lowgamma.push(lowgamma);
        EEG.atlas.map[i].data.means.lowgamma.push(eegmath.mean(lowgamma));
      }
      if(EEG.atlas.shared.bandFreqs.highgamma[1].length > 0){
        var highgamma = posFFTList[channel].slice( EEG.atlas.shared.bandFreqs.highgamma[1][0], EEG.atlas.shared.bandFreqs.highgamma[1][EEG.atlas.shared.bandFreqs.highgamma[1].length-1]+1);
        EEG.atlas.map[i].data.slices.highgamma.push(highgamma);
        EEG.atlas.map[i].data.means.highgamma.push(eegmath.mean(highgamma));
      }
      //console.timeEnd("slicing bands");
      return true;
    }
  });
}

var mapCoherenceData = () => {
  coherenceResults.forEach((row,i) => {
    EEG.coherenceMap.map[i].data.amplitudes.push(row);
  
  if(EEG.coherenceMap.shared.bandFreqs.scp[1].length > 0){
    var scp = row.slice( EEG.coherenceMap.shared.bandFreqs.scp[1][0], EEG.coherenceMap.shared.bandFreqs.scp[1][EEG.coherenceMap.shared.bandFreqs.scp[1].length-1]+1);
    EEG.coherenceMap.map[i].data.slices.scp.push(scp);
    EEG.coherenceMap.map[i].data.means.scp.push(eegmath.mean(scp));
  }
  if(EEG.coherenceMap.shared.bandFreqs.delta[1].length > 0){
    var delta = row.slice( EEG.coherenceMap.shared.bandFreqs.delta[1][0], EEG.coherenceMap.shared.bandFreqs.delta[1][EEG.coherenceMap.shared.bandFreqs.delta[1].length-1]+1);
    EEG.coherenceMap.map[i].data.slices.delta.push(delta);
    EEG.coherenceMap.map[i].data.means.delta.push(eegmath.mean(delta));
  }
  if(EEG.coherenceMap.shared.bandFreqs.theta[1].length > 0){
    var theta = row.slice( EEG.coherenceMap.shared.bandFreqs.theta[1][0], EEG.coherenceMap.shared.bandFreqs.theta[1][EEG.coherenceMap.shared.bandFreqs.theta[1].length-1]+1);
    EEG.coherenceMap.map[i].data.slices.theta.push(theta);
    EEG.coherenceMap.map[i].data.means.theta.push(eegmath.mean(theta));
  }
  if(EEG.coherenceMap.shared.bandFreqs.alpha[1].length > 0){
    var alpha = row.slice( EEG.coherenceMap.shared.bandFreqs.alpha[1][0], EEG.coherenceMap.shared.bandFreqs.alpha[1][EEG.coherenceMap.shared.bandFreqs.alpha[1].length-1]+1);
    EEG.coherenceMap.map[i].data.slices.alpha.push(alpha);
    EEG.coherenceMap.map[i].data.means.alpha.push(eegmath.mean(alpha));
  }
  if(EEG.coherenceMap.shared.bandFreqs.beta[1].length > 0){
    var beta  = row.slice( EEG.coherenceMap.shared.bandFreqs.beta[1][0],  EEG.coherenceMap.shared.bandFreqs.beta[1][EEG.coherenceMap.shared.bandFreqs.beta[1].length-1]+1);
    EEG.coherenceMap.map[i].data.slices.beta.push(beta);
    EEG.coherenceMap.map[i].data.means.beta.push(eegmath.mean(beta));
  }
  if(EEG.coherenceMap.shared.bandFreqs.lowgamma[1].length > 0){
    var lowgamma = row.slice( EEG.coherenceMap.shared.bandFreqs.lowgamma[1][0], EEG.coherenceMap.shared.bandFreqs.lowgamma[1][EEG.coherenceMap.shared.bandFreqs.lowgamma[1].length-1]+1);
    EEG.coherenceMap.map[i].data.slices.lowgamma.push(lowgamma);
    EEG.coherenceMap.map[i].data.means.lowgamma.push(eegmath.mean(lowgamma));
  }
  if(EEG.coherenceMap.shared.bandFreqs.highgamma[1].length > 0){
    var highgamma = row.slice( EEG.coherenceMap.shared.bandFreqs.highgamma[1][0], EEG.coherenceMap.shared.bandFreqs.highgamma[1][EEG.coherenceMap.shared.bandFreqs.highgamma[1].length-1]+1);
    EEG.coherenceMap.map[i].data.slices.highgamma.push(highgamma);
    EEG.coherenceMap.map[i].data.means.highgamma.push(eegmath.mean(highgamma));
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
  var l=0;
  cordfts.forEach((row,i) => { //move autocorrelation results to front to save brain power
    if (l+k === nChannels) {
      var temp = cordfts.splice(i,1);
      k++;
      cordfts.splice(k,0,...temp);
      l=0;
      console.log(i);
    }
    l++;
  });
  //Now arranged like [0:0,1:1,2:2,3:3,4:4,0:1,0:2,0:3,0:4,1:2,1:3,1:4,2:3,2:4,3:4]

  //Outputs FFT coherence data in order of channel data inputted e.g. for 4 channels resulting DFTs = [0:1,0:2,0:3,0:4,1:2,1:3,1:4,2:3,2:4,3:4];
  //TODO:Optimize this e.g. with a bulk dispatch to GPUJS
  var autoFFTproducts = [];
  k = 0;
  l = 1;
  cordfts.forEach((dft,i) => {
    var newdft = [];
    if(i < nChannels) { //first multiply autocorrelograms
    dft.forEach((amp,j) => {
      newdft.push(amp*dfts[i][j]*.5);
    });
    autoFFTproducts.push(newdft);
    }
    else{ //now multiply cross correlograms
    var timeMod = (nSec-1)*.3333333;
    if(timeMod === 0) { timeMod = 1 }
    dft.forEach((amp,j) => {           
      newdft.push(amp*autoFFTproducts[k][j]*autoFFTproducts[k+l][j]*.3333333*timeMod);
    });
    l++;
    if((l+k) === nChannels) {
      k++;
      l = 1;
    }
    coherenceResults.push(newdft);
    }
  });

  return [dfts[0],dfts[1],coherenceResults]
}

//---------------------------------------
//----------- UPDATE VISUALS ------------
//---------------------------------------

var updateuPlot = () => {

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
        uPlotData = [bandPassWindow,...coherenceResults];
    }
  
    //console.log(uPlotData)
    if(graphmode === "Stacked"){
      uplotter.makeStackeduPlot(undefined,uPlotData,undefined,EEG.channelTags);
    }
    else {
      uplotter.plot.setData(uPlotData);
    }

}

var updateSmoothieCharts = () => {
    //Smoothie charts
    EEG.channelTags.forEach((row,i) => {
      var coord = EEG.getAtlasCoordByTag(row.tag);
      if(i === channelView) {
        Smoothie1.bulkAppend([
          Math.max(...coord.data.slices.delta[coord.data.slices.delta.length-1]),
          Math.max(...coord.data.slices.theta[coord.data.slices.theta.length-1]),
          Math.max(...coord.data.slices.alpha[coord.data.slices.alpha.length-1]),
          Math.max(...coord.data.slices.beta[coord.data.slices.beta.length-1]),
          Math.max(...coord.data.slices.lowgamma[coord.data.slices.lowgamma.length-1])
        ]);
      }
      if(i < Smoothie2.series.length - 1){
        Smoothie2.series[i].append(Date.now(), Math.max(...coord.data.slices.delta[coord.data.slices.delta.length-1]));
      }
    });
}

var updateBrainMap = () => {
    //Brainmap
  //normalize the point sizes to a max of 90.
  var viewing = document.getElementById("bandview").value;
  brainMap.updateHeatmapFromAtlas(EEG.atlas,EEG.channelTags,viewing);

  if(coherenceResults.length === EEG.coherenceMap.map.length){
    brainMap.updateConnectomeFromAtlas(EEG.coherenceMap,EEG.atlas,EEG.channelTags,viewing);
  }
}


var updateFFTVisuals = () => { //TODO: adjust visuals based on expected voltages to make it generically applicable

  updateuPlot();

  //---------------------------------------------------------------

  updateSmoothieCharts();

  //-----------------------------------------------------------------

  updateBrainMap();

  //------------------------------------------------------------------

}






//---------------------------------------
//----------- PERFORM ANALYSIS ----------
//---------------------------------------


function processFFTs() {
    
  //Separate and report channel results by band
  EEG.channelTags.forEach((row,i) => {
      if((row.tag !== null) && (i < EEG.nChannels)){
          //console.log(tag);
          channelBands(i,row.tag);
      }        
  });

}


//Should do a lot of this with a worker to keep the UI smooth and prevent hangups
var analysisLoop = () => {
  if((analyze === true) && (newMsg === true)) {
    //console.log("analyzing")
      var buffer = [];
      for(var i = 0; i < EEG.channelTags.length; i++){
          if(i < EEG.nChannels) {
              var channel = "A"+EEG.channelTags[i].ch;
              var dat = EEG.data[channel].slice(EEG.data.counter - EEG.sps, EEG.data.counter);
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

        if(fdbackmode === "coherence") {
          console.time("GPU DFT + coherence");
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

          posFFTList.forEach((row,i) => {
            row.map( x => x * stepsPeruV);
          });
  
        }
        
        processFFTs();
        
        //Update visuals
        updateFFTVisuals();
      }

      //console.log(coherenceResults);
  }
  if(analyze === true) {setTimeout(() => {analyzeloop = requestAnimationFrame(analysisLoop);},50)};
  
}


//-------------------------------------------
//---------------RAW DATA VIS----------------
//-------------------------------------------




var updateRawFeed = () => {
  
  updateTimeCharts();

  setTimeout(() => {if(feed === true) {requestAnimationFrame(updateRawFeed);}}, 15);
}


//-------------------------------------------
//----------------Worker stuff---------------
//-------------------------------------------


//For handling worker messages
window.receivedMsg = (msg) => {
  if(msg.foo === "multidftbandpass") {
    //console.log(msg)
    posFFTList = [...msg.output[1]];
    posFFTList.forEach((row,i) => {
      row.map( x => x * stepsPeruV);
    });
    
    processFFTs();
    anim = requestAnimationFrame(updateFFTVisuals);
    
  }
  if(msg.foo === "coherence") {
    posFFTList = [...msg.output[1]];
    posFFTList.forEach((row,i) => {
      row.map( x => x * stepsPeruV);
    });


    coherenceResults = [...msg.output[2]];
    processFFTs();
    mapCoherenceData();
    anim = requestAnimationFrame(updateFFTVisuals);
  }
  newMsg = true;
}




//---------------------------------------
//-------------- UI SETUP ---------------
//---------------------------------------




//Container HTML and menus to be targeted by the appropriate class

function genVisualContainer(containerId){
  return `
  <div id=`+containerId+`></div>
  `; //Put menus in here for switching inner visuals?
}

function genuPlotContainer(containerId, plotId) {
  return `
  <div id='`+containerId+`'>
    <select id='`+plotId+`mode'>
      <option value="FFT" selected="selected">FFTs</option>
      <option value="Coherence">Coherence</option>
      <option value="TimeSeries">Raw</option>
    </select>
    <h3 id='`+plotId+`title'>FFTs</h3>
    <div id='`+plotId+`'></div>
  </div>`
}

function genSmoothieContainer(containerId, plotId) {
  return ` 
  <div id='`+containerId+`'> 
    Mode:
    <select id='`+plotId+`mode'>
      <option value="alpha" selected="selected">Alpha Bandpowers</option>
      <option value="coherence">Alpha Coherence</option>
      <option value="bandpowers">1Ch All Bandpowers</option>
    </select>
    Channels:
    <select id='`+plotId+`channel'>
      <option value="0">0</option>
    </select>
    <div id='`+plotId+`title'>Smoothiejs</div> 
      <canvas id='`+plotId+`'></canvas> 
  </div>
  `;
}

function genBrainMapContainer(containerId, brainmapId){
  return ` 
  <div id='`+containerId+`'>  
    <table id='`+brainmapId+`table'>
      <tr><td><h3>Brain Map (see "atlas" in the console and set corresponding channel tags (see "channelTags")) | </h3></td>
      <td><h4>Viewing:</h4></td>
      <td><select id='`+brainmapId+`bandview'>
        <option value="scp">SCP (0.1Hz-1Hz)</option>
        <option value="delta">Delta (1Hz-4Hz)</option>
        <option value="theta">Theta (4Hz-8Hz)</option>
        <option value="alpha" selected="selected">Alpha (8Hz-12Hz)</option>
        <option value="beta">Beta (12Hz-35Hz)</option>
        <option value="lowgamma">Low Gamma (35Hz-48Hz)</option>
        <option value="highgamma">High Gamma (48Hz+)</option>
      </select></td></tr>
    </table>
    <canvas id='`+brainmapId+`'></canvas>
    <canvas id='`+brainmapId+`points'></canvas>
  `;
}

function genTimeChartContainer(containerId,timechartsId) {
  return `
  <div id='`+containerId+`'>
    <div id='`+timechartsId+`'></div>
  </div>
  `;
}

function genSpectrogramContainer(containerId,spectrogramId) {
  return `
  <div id=`+containerId+`>
    Mode
    <select id='`+spectrogramId+`mode'>
      <option value="FFT" selected="selected">FFT</option>
      <option value="Coherence">Coherence</option>
    </select>
    Channel
    <select id='`+spectrogramId+`channel'>
      <option value="0" selected="selected">0</option>
    </select>
    <canvas id='`+spectrogramId+`'></canvas>
  </div>
  `;
}

function genBarChartContainer(containerId, barchartId) {
  return `
  <div id='`+containerId+`'>
    Channel
    <select id='`+barchartId+`channel'>
      <option value="0" selected="selected">0</option>
    </select>
    <canvas id='`+barchartId+`'></canvas>
  </div>
  `;
}

function genMirrorChartsContainer(containerId, mirrorchartsId) {
  return `
  <div id='`+containerId+`'>
    Channel 1
    <select id='`+mirrorchartsId+`channel1'>
      <option value="0" selected="selected">0</option>
      <option value="1">1</option>
    </select>
    Channel 2
    <select id='`+mirrorchartsId+`channel2'>
      <option value="0" selected="selected">0</option>
      <option value="1">1</option>
    </select>
    <div id='`+mirrorchartsId+`'></div>
  </div>
  `;
}


//Setup for appending HTML and creating class instances
function setupVisualContainer(containerId, height, width, appendTo){
  var containerobj = {
    id: containerId,
    elem: null,
    child: null,
    width: width,
    height: height,
    mode: "none",
    class: null
  };

  var HTMLtoAppend = genVisualContainer(containerId);
  appendFragment(HTMLtoAppend, appendTo);
  containerobj.id = containerId;
  containerobj.elem = document.getElementById(containerId);

  return containerobj; //Make sure to store this
}


function addChannelOptions(selectId) {
  var select = document.getElementById(selectId);
  select.innerHTML = "";
  var opts = ``;
  EEG.channelTags.forEach((row,i) => {
    if(i === 0) {
      opts += `<option value='`+row.ch+`' selected='selected'>`+row.ch+`</option>`
    }
    else {
      opts += `<option value='`+row.ch+`'>`+row.ch+`</option>`
    }
  });
  select.innerHTML = opts;
}


function deleteChildContainer(obj) {
  obj.class.deInit();
  obj.elem.removeChild(obj.child);
  obj.class = null;
  obj.mode = "none";
}


function setupuPlotContainer(containerId, plotId, obj) {
  var HTMLtoAppend = genuPlotContainer(containerId, plotId);
  appendFragment(HTMLtoAppend,obj.id);
  obj.class = new uPlotMaker(plotId);
  obj.mode = "uplot";
  obj.child = document.getElementById(containerId);

  obj.class.uPlotData = [session.bandPassWindow];
  EEG.channelTags.forEach(() => {
    obj.class.uPlotData.push(bandPassWindow)
  })

  obj.class.makeuPlot(obj.class.makeSeriesFromChannelTags(EEG.channelTags),obj.class.uPlotData);

}


function setupSmoothieContainer(containerId, plotId, obj) {
  var HTMLtoAppend = genSmoothieContainer(containerId, plotId);
  appendFragment(HTMLtoAppend,obj.id);
  addChannelOptions(plotId+"channel");
  obj.class = new SmoothieChartMaker(8,plotId);
  obj.mode = "smoothie";
  obj.child = document.getElementById(containerId);
}

function setupBrainMapContainer(containerId, brainmapId, obj) {
  var HTMLtoAppend = genBrainMapContainer(containerId, brainmapId);
  appendFragment(HTMLtoAppend,obj.Id);
  obj.class = new brainMap2D(brainMapId,brainMapId+"points");
  obj.mode = "brainmap";
  obj.child = document.getElementById(containerId);
  
  obj.class.genHeatMap();
  obj.class.points = [];
  EEG.atlas.map.forEach((row,i) => {
    obj.class.points.push({x:row.data.x*1.5+200, y:200-row.data.y*1.5, size:130, intensity:0.8});
  });
  obj.class.updateHeatMap();
  obj.class.updatePointsFromAtlas(EEG.atlas,EEG.channelTags);
}

function setupTimeChartContainer(containerId, timechartsId, obj) {
  var HTMLtoAppend = genTimeChartContainer(containerId, timechartsId);
  appendFragment(HTMLtoAppend,obj.id);
  obj.class = new TimeChartMaker(timechartsId);
  obj.mode = "timecharts";
  obj.child = document.getElementById(containerId);
  obj.class.setEEGTimeCharts(EEG);
}

function setupSpectrogramContainer(containerId, spectrogramId, obj) {
  var HTMLtoAppend = genSpectrogramContainer(containerId, spectrogramId);
  appendFragment(HTMLtoAppend,obj.id);
  addChannelOptions(spectrogramId+"channel");
  obj.class = new Spectrogram(spectrogramId, 700);
  obj.mode = "spectrogram";
  obj.child = document.getElementById(containerId);
  obj.class.init();

  document.getElementById(spectrogramId+"mode").onchange = () => {
    if(document.getElementById(spectrogramId+"mode").value === "FFT"){
      addChannelOptions(spectrogramId+"channel");
    }
    else if(document.getElementById(spectrogramId+"mode").value === "Coherence"){
      var select = document.getElementById(spectrogramId+"channel");
      select.innerHTML = "";
      var newhtml = ``;
      EEG.coherenceMap.map.forEach((row,i) => {
        if(i===0) {
          newhtml += `<option value='`+row.ch+`' selected="selected">`+row.ch+`</option>`;
        }
        else{
          newhtml += `<option value='`+row.ch+`'>`+row.ch+`</option>`;
        }
      });
      select.innerHTML = html;
    }
  }
}

function setupBarChartContainer(containerId, barchartId, obj) {
  var HTMLtoAppend = genBarChartContainer(containerId,barchartId);
  appendFragment(HTMLtoAppend,obj.id);
  addChannelOptions(barchartId+"channel");
  obj.class = new eegBarChart(barchartId, 700);
  obj.mode = "bars";
  obj.child = document.getElementById(containerId);
  obj.class.init();
}

function setupMirrorChartsContainer(containerId, mirrorchartsId, obj) {
  var HTMLtoAppend = genMirrorChartsContainer(containerId, mirrorchartsId);
  appendFragment(HTMLtoAppend,obj.id);
  addChannelOptions(mirrorchartsId+"channel1");
  addChannelOptions(mirrorchartsId+"channel2");
  obj.class = new mirrorBarChart(mirrorchartsId, 700);
  obj.mode = "mirror";
  obj.child = document.getElementById(containerId);
  obj.class.init();
}



//Updating for raw and fft data per visual container
function updateVisualContainers(containerArr) { //types: coherence, raw
  containerArr.forEach((obj,i) => {
    if(obj.mode === "uplot") {
      var graphmode = document.getElementById(obj.class.canvasId+"mode").value;
      if(graphmode === "FFT"){
          //Animate plot(s)
          obj.class.uPlotData = [
              session.bandPassWindow
          ];
    
          EEG.channelTags.forEach((row,i) => {
              if(row.viewing === true) {
                obj.class.uPlotData.push(session.posFFTList[i]);
              }
          });
      }
    
      else if ((graphmode === "TimeSeries") || (graphmode === "Stacked")) {
          var nsamples = Math.floor(EEG.sps*session.nSecAdcGraph);
    
          uPlotData = [
              EEG.data.ms.slice(EEG.data.counter - nsamples, EEG.data.counter)
          ];
    
          EEG.channelTags.forEach((row,i) => {
              if(row.viewing === true) {
                obj.class.uPlotData.push(EEG.data["A"+row.ch].slice(EEG.data.counter - nsamples, EEG.data.counter));
              }
          });
      }
    
      else if (graphmode === "Coherence") {
        obj.class.uPlotData = [session.bandPassWindow,...session.coherenceResults];
      }
    
      //console.log(uPlotData)
      if(graphmode === "Stacked"){
        obj.class.makeStackeduPlot(undefined,obj.class.uPlotData,undefined,EEG.channelTags);
      }
      else {
        obj.class.plot.setData(obj.class.uPlotData);
      }
    }

    else if(obj.mode === "smoothie") {
      var graphmode = document.getElementById(obj.class.canvasId+"mode");
      if((graphmode === "alpha") || (graphmode === "bandpowers")) {
        if(graphmode === "alpha"){ 
          EEG.channelTags.forEach((row,i) => {
            var coord = {};
            coord = EEG.getAtlasCoordByTag(row.tag);
            
            if(i < obj.class.series.length - 1){
              obj.class.series[i].append(Date.now(), Math.max(...coord.data.slices.alpha[coord.data.slices.alpha.length-1]));
            }
          });
        }
        else if(graphmode === "bandpowers") {
          var ch = document.getElementById(obj.class.canvasId+"channel").value;
          var tag = null;
          EEG.channelTags.find((o,i) => {
            if(o.ch === ch){
              tag = o.tag;
              return true;
            }
          });
          if(tag !== null){
            var coord = EEG.getAtlasCoordByTag(tag);
            obj.class.bulkAppend([
              Math.max(...coord.data.slices.delta[coord.data.slices.delta.length-1]),
              Math.max(...coord.data.slices.theta[coord.data.slices.theta.length-1]),
              Math.max(...coord.data.slices.alpha[coord.data.slices.alpha.length-1]),
              Math.max(...coord.data.slices.beta[coord.data.slices.beta.length-1]),
              Math.max(...coord.data.slices.lowgamma[coord.data.slices.lowgamma.length-1])
            ]);
          }
        }
      }
      else if (graphmode === "coherence") {
        EEG.coherenceMap.map.forEach((row,i) => {
          if(i < obj.class.series.length - 1){
            obj.class.series[i].append(Date.now(), Math.max(...row.data.slices.alpha[row.data.slices.alpha.length-1]));
          }
        });
      }
    }
    else if(obj.mode === "brainmap") {
      var viewing = document.getElementById("bandview").value;
      obj.class.updateHeatmapFromAtlas(EEG.atlas,EEG.channelTags,viewing);

      if(session.coherenceResults.length === EEG.coherenceMap.map.length){
        obj.class.updateConnectomeFromAtlas(EEG.coherenceMap,EEG.atlas,EEG.channelTags,viewing);
      }
    }
    else if(obj.mode === "timecharts") {
      obj.class.updateTimeCharts(EEG);
    }
    else if(obj.mode === "spectrogram") {
      var graphmode = document.getElementById(obj.class.canvasId+"mode");
      var ch = document.getElementById(obj.class.canvasId+"channel").value;
      if(graphmode === "FFT"){
        var tag = null;
        EEG.channelTags.find((o,i) => {
          if(o.ch === ch){
            tag = o.tag;
            return true;
          }
        });
        if(tag !== null){
          var coord = EEG.getAtlasCoordByTag(tag);
          obj.spectrogram.latestData = coord.data.amplitudes[coord.data.amplitudes.length-1];
        }
      }
      else if(graphmode === "Coherence"){
        var coord = null;
        EEG.coherenceMap.map.find((o,i) => {
          if(o.tag === ch){
            coord = o.data;
          }
        });
        obj.spectrogram.latestData = coord.data.amplitudes[coord.data.amplitudes.length - 1];
      }
    }
    else if(obj.mode === "bars") {
      var ch = document.getElementById(obj.class.canvasId+"channel").value;
      var tag = null;
      EEG.channelTags.find((o,i) => {
        if(o.ch === ch){
          tag = o.tag;
          return true;
        }
      });
      if(tag !== null){
        var coord = EEG.getAtlasCoordByTag(tag);
        obj.spectrogram.latestData = coord.data.amplitudes[coord.data.amplitudes.length-1];
      }
      
    }
    else if(obj.mode === "mirror") {
      var ch1 = document.getElementById(obj.class.canvasId+"channel1").value;
      var tag1 = null;
      EEG.channelTags.find((o,i) => {
        if(o.ch === ch1){
          tag1 = o.tag;
          return true;
        }
      });
      
      var ch2 = document.getElementById(obj.class.canvasId+"channel2").value;
      var tag2 = null;
      EEG.channelTags.find((o,i) => {
        if(o.ch === ch2){
          tag2 = o.tag;
          return true;
        }
      });
      var coord1, coord2;
      if(tag1 !== null){
        coord1 = EEG.getAtlasCoordByTag(tag1);
        if(tag2 !== null){
          coord2 = EEG.getAtlasCoordByTag(tag2);
          obj.class.updateCharts(coord1.data.slices[coord1.data.slices.length-1],coord2.data.slices[coord2.data.slices.length-1]);
        }
      }    
    }
  })
}


//-------------- BUTTON SETUP -----------

var setuPlot = (gmode) => {
  if(gmode === "TimeSeries"){
    document.getElementById("uplottitle").innerHTML = "ADC signals";
    
    if(EEG.data["A0"].length > 1) {
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
    else {
      uPlotData = [bandPassWindow];
      EEG.channelTags.forEach((row,i) => {
        uPlotData.push(bandPassWindow);
      });
    }
    uplotter.makeuPlot(uplotter.makeSeriesFromChannelTags(EEG.channelTags), uPlotData);
    uplotter.plot.axes[0].values = (u, vals, space) => vals.map(v => +(v*0.001).toFixed(2) + "s");
    
  }
  else if (gmode === "FFT"){

        document.getElementById("uplottitle").innerHTML = "ADC FFTs w/ Bandpass";
          //Animate plot(s)
        uPlotData = [
            bandPassWindow
        ];
        if((posFFTList.length > 0) && (posFFTList.length <= EEG.channelTags.length)) {
          //console.log(posFFTList);
          EEG.channelTags.forEach((row,i) => {
            if(i < posFFTList.length){
              if(row.viewing === true) {
                  uPlotData.push(posFFTList[i]);
              }
            }
            else{
              uPlotData.push(bandPassWindow); // Placeholder for unprocessed channel data.
            }
          });
        }
        else {
          EEG.channelTags.forEach((row,i) => {
            uPlotData.push(bandPassWindow);
          });
        }
        uplotter.makeuPlot(uplotter.makeSeriesFromChannelTags(EEG.channelTags), uPlotData);
  }
  else if (gmode === "Stacked") {

    if(EEG.data["A0"].length > 1){
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
    else {
      uPlotData = [bandPassWindow];
      EEG.channelTags.forEach((row,i) => {
        uPlotData.push(bandPassWindow);
      });
    }

    document.getElementById("uplottitle").innerHTML = "ADC signals Stacked";
    
    //console.log(uPlotData)
    uplotter.makeStackeduPlot(undefined, uPlotData, undefined, EEG.channelTags);
    
  }
  else if (gmode === "Coherence") {

    if((coherenceResults.length > 0) && (coherenceResults.length <= EEG.coherenceMap.map.length)){
      uPlotData = [bandPassWindow,...coherenceResults];
      if(uPlotData.length < EEG.coherenceMap.map.length+1) {
        for(var i = uPlotData.length; i < EEG.coherenceMap.map.length+1; i++){
          uPlotData.push(bandPassWindow);
        }
      }
      //console.log(uPlotData)
      
      var newSeries = [{}];
    
      var l = 1;
      var k = 0;
      
      EEG.coherenceMap.map.forEach((row,i) => {
        var tag1 = EEG.channelTags[k].tag;
        var tag2 = EEG.channelTags[k+l].tag;
        if(tag1 === null){tag1 = "A"+EEG.channelTags[k].ch} //Untagged, give it the channel number
        if(tag2 === null){tag2 = "A"+EEG.channelTags[k+l].ch}
        newSeries.push({
          label:tag1+":"+tag2,
          value: (u, v) => v == null ? "-" : v.toFixed(1),
          stroke: "rgb("+Math.random()*255+","+Math.random()*255+","+Math.random()*255+")"
        });
        l++;
        if(l+k === EEG.channelTags.length){
          k++;
          l=1;
        }
      });
    }
    else {
      uPlotData = [bandPassWindow];
      EEG.channelTags.forEach((row,i) => {
        uPlotData.push(bandPassWindow);
      });
    }
    //console.log(newSeries.length);
    //console.log(uPlotData.length);
  
    uplotter.makeuPlot(newSeries, uPlotData);
  
    document.getElementById("uplottitle").innerHTML = "Coherence from tagged signals";
  }
  //else if(graphmode === "StackedRaw") { graphmode = "StackedFFT" }//Stacked Coherence
  
}


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
    freq1 = EEG.sps*0.5; document.getElementById("freqEnd").value = freq1;
  }
  freqStart = freq0;
  freqEnd = freq1;

  EEG.atlas = EEG.makeAtlas10_20(); //reset atlas 

  bandPassWindow = gpu.bandPassWindow(freq0,freq1,EEG.sps);

  EEG.atlas.shared.bandPassWindow = bandPassWindow;//Push the x-axis values for each frame captured as they may change - should make this lighter
  EEG.atlas.shared.bandFreqs = EEG.getBandFreqs(bandPassWindow); //Update bands accessed by the atlas for averaging

  if(fdbackmode === "coherence") {
    EEG.coherenceMap = EEG.genCoherenceMap(EEG.channelTags);
    EEG.coherenceMap.bandPasswindow - bandPassWindow;
    EEG.coherenceMap.shared.bandFreqs = EEG.atlas.shared.bandFreqs;
  }
}

document.getElementById("bandview").onchange = () => {
  var viewing = document.getElementById("bandview").value;
  brainMap.updateHeatmapFromAtlas(EEG.atlas,EEG.channelTags,viewing);
  brainMap.updateConnectomeFromAtlas(EEG.coherenceMap,EEG.atlas,EEG.channelTags,viewing);
}

document.getElementById("graphmode").onclick = () => {
  if(graphmode === "TimeSeries") {
    //graphmode = "Stacked";
    graphmode = "Coherence";
  }
  else if(graphmode === "Stacked"){
    graphmode = "Coherence";
  }
  else if(graphmode === "Coherence"){
    graphmode = "FFT";
  }
  else if(graphmode === "FFT") {
    graphmode = "TimeSeries";
  }
  //else if(graphmode === "StackedRaw") { graphmode = "StackedFFT" }//Stacked Coherence
  
  setuPlot(graphmode);
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

setuPlot(graphmode);

}



document.getElementById("setTags").onclick = () => {
  var val = document.getElementById("channelTags").value;
  if(val.length === 0) { return; }
  //console.log(val);
  var arr = val.split(";");
  //console.log(arr);
  //channelTags.forEach((row,j) => { channelTags[j].viewing = false; });
  //console.log(arr);
  arr.forEach((item,i) => {
    var dict = item.split(":");
    var found = false;
    let setTags = EEG.channelTags.find((o, j) => {
      if(o.ch === parseInt(dict[0])){
        if(dict[1] === "delete"){
          EEG.channelTags.splice(j,1);
        }
        else{
          let otherTags = EEG.channelTags.find((p,k) => {
            if(p.tag === dict[1]){
              EEG.channelTags[k].tag = null;
              return true;
            }
          });
        
          //console.log(o);
          EEG.channelTags[j].tag = dict[1];
          EEG.channelTags[j].viewing = true;

          if(dict[2] !== undefined){
            var atlasfound = false;
            var searchatlas = EEG.atlas.map.find((p,k) => {
              if(p.tag === dict[1]){
                atlasfound = true;
                return true;
              }
            });
            if(atlasfound !== true) {
              var coords = dict[2].split(",");
              if(coords.length === 3){
                EEG.addToAtlas(dict[1],parseFloat(coords[0]),parseFloat(coords[1]),parseFloat(coords[2]))
              }
            }
          }
        }
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
        if((ch >= 0) && (ch < EEG.nChannels)){
          EEG.channelTags.push({ch:parseInt(ch), tag: dict[1], viewing: true});
        
          if(dict[2] !== undefined){
            var atlasfound = false;
            var searchatlas = EEG.atlas.map.find((p,k) => {
              if(p.tag === dict[1]){
                atlasfound = true;
                return true;
              }
            });
            if(atlasfound !== true) {
              var coords = dict[2].split(",");
              if(coords.length === 3){
                EEG.addToAtlas(dict[1],parseFloat(coords[0]),parseFloat(coords[1]),parseFloat(coords[2]))
              }
            }
          }
        }
      }
    }
  });

  if(uPlotData.length - 1 < EEG.channelTags.length) {
    while (uPlotData.length - 1 < EEG.channelTags.length) {
      uPlotData.push(bandPassWindow);
    }
  }
  
  EEG.coherenceMap = EEG.genCoherenceMap(EEG.channelTags); //Reset coherence map with new tags
  EEG.coherenceMap.shared.bandPassWindow = bandPassWindow;
  EEG.coherenceMap.shared.bandFreqs = EEG.atlas.shared.bandFreqs;

  brainMap.updatePointsFromAtlas(EEG.atlas,EEG.channelTags);

  brainMap.updateConnectomeFromAtlas(EEG.coherenceMap,EEG.atlas,EEG.channelTags);

  setuPlot(graphmode);
}





//-------------------------------------------
//-------------------TEST--------------------
//-------------------------------------------


var sine  = eegmath.genSineWave(40,500,1,512);
var sine1 = eegmath.genSineWave(30,3000,1,512);
var sine2 = eegmath.genSineWave(40,1000,1,512);
var sine3 = eegmath.genSineWave(20,500,1,512);
var sine4 = eegmath.genSineWave(12,2500,1,512);
var sine5 = eegmath.genSineWave(5,1000,1,512);
var sine6 = eegmath.genSineWave(30,750,1,512);

var bigarr = new Array(128).fill(sine[1]);

//console.log(sine)
function testGPU(){
  console.log("testGPU()");
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd],0);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd],0);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd],0);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd],0);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd],0);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd],0);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd],0);
  window.postToWorker("multidftbandpass", [bigarr,1,freqStart,freqEnd],0);
  console.log("posted 128x dft 8 times");
}

function testCoherence(){
  console.log("testCoherence()");
  window.postToWorker("coherence", [[sine[1],sine2[1]],1,freqStart,freqEnd],1);
  window.postToWorker("coherence", [[sine[1],sine2[1]],1,freqStart,freqEnd],1);
  window.postToWorker("coherence", [[sine[1],sine2[1]],1,freqStart,freqEnd],1);
  window.postToWorker("coherence", [[sine[1],sine2[1]],1,freqStart,freqEnd],1);

}



setTimeout(()=>{setTimeout(()=>{testCoherence();},500)},1000); //Need to delay this call since app.js is made before the worker script is made




    
