import uPlot from 'uplot';
import { SmoothieChart, TimeSeries } from "smoothie";
import './utils/webgl-heatmap'

//---------------------------------------------------------------------------------
//---------------------------------------------------------------------------------
//-------------------------------EEG Visual Classes--------------------------------
//---------------------------------------------------------------------------------
//---------------------------------------------------------------------------------

//Nice time series charts based on smoothiejs
export class SmoothieChartMaker {
	constructor(nSeries = 1, canvasId=null, gridStrokeStyle = 'rgb(125, 125, 125)', gridFillStyle = 'rgb(10, 10, 10)', labelFillStyle = 'rgb(255, 255, 255)') {
		if(typeof(SmoothieChart) === 'undefined'){
			alert("smoothie.js not found!");
			return false;
		}

		this.canvasId = canvasId;
		this.canvas = null;
		this.series = [];
		this.seriesColors = [];
		this.chart = null;
		this.canvasId = canvasId;

		for(var n = 0; n < nSeries; n++) {
			var newseries = new TimeSeries();
			this.series.push(newseries);
		}

		if(canvasId !== null) {
			this.canvas = document.getElementById(this.canvasId);
			this.makeSmoothieChart(this.canvasId, gridStrokeStyle, gridFillStyle, labelFillStyle);
		}

	}

	makeSmoothieChart( canvasId = null, gridStrokeStyle = 'rgb(125, 125, 125)', gridFillStyle = 'rgb(10, 10, 10)', labelFillStyle = 'rgb(255, 255, 255)') 
	{
		this.chart = new SmoothieChart({ 
			responsive: true,
			grid: { strokeStyle:gridStrokeStyle, fillStyle:gridFillStyle,
			lineWidth: 1, millisPerLine: 500, verticalSections: 6, },
			labels: { fillStyle: labelFillStyle }
		});

		this.series.forEach((series, i) => {
			var stroke = ''; //Set the initial stroke and fill styles to be the same each time
			var fill = '';
			if(i === 0) { stroke = 'purple'; fill = 'rgba(128,0,128,0.2)'; }
			if(i === 1) { stroke = 'orange'; fill = 'rgba(255,128,0,0.2)'; }
			if(i === 2) { stroke = 'green';  fill = 'rgba(0,255,0,0.2)';   }
			if(i === 3) { stroke = 'blue';   fill = 'rgba(0,0,255,0.2)' ;  }
			if(i === 4) { stroke = 'red';    fill = 'rgba(255,0,0,0.2)';   }
			else { 
				var r = Math.random()*255, g = Math.random()*255, b = Math.random()*255;
				stroke = 'rgb('+r+","+g+","+b+")"; fill = 'rgba('+r+','+g+','+b+","+"0.2)";
			}
			this.seriesColors.push(stroke); // For reference
			this.chart.addTimeSeries(series, {strokeStyle: stroke, fillStyle: fill, lineWidth: 2 });
		});

		if(canvasId !== null){
			this.chart.streamTo(document.getElementById(canvasId), 500);
		}
	}

	streamTo(canvasId = null){
		if(parentId !== null) {
			this.chart.streamTo(document.getElementById(canvasId), 500);
		}
		else { console.log("Needs a canvas id to stream the chart to");}
	}

	bulkAppend(dat = [0.5]){ //Append single values or arrays, appends to series by dat index, in order of series, set others to zero or the last datum if no new data
		var now = Date.now()
		dat.forEach((datum, i) => {
			this.series[i].append(now, datum);
		});
	}
}

//Lightweight plotter based on uplot.iife.min.js
//TODO - big vertical chart comparing all channel data 
//E.g. y-shifted series https://leeoniya.github.io/uPlot/demos/y-shifted-series.html
//Other examples to draw from: https://leeoniya.github.io/uPlot/demos/resize.html
// https://leeoniya.github.io/uPlot/demos/draw-hooks.html
// https://leeoniya.github.io/uPlot/demos/latency-heatmap.html
export class uPlotMaker {
	constructor(canvasId = null) {
		if(uPlot === 'undefined') {
			console.log("uPlot not detected!");
			return false;
		}

		this.canvasId = canvasId;
		this.plot = null;
	}

	makeuPlot(series=[{}], data=[], width=1000, height=400, options = null) {
		if(series.length < 2) { console.log("Input valid series"); return false;}
		var uPlotOptions = {};
		if(options === null){
			uPlotOptions = {
				title: "EEG Output",
				width: width,
				height: height,
				series: series,
				axes: [
				{
				scale: "Hz",
				values: (u, vals, space) => vals.map(v => +v.toFixed(1) + "Hz")
				},
			]}
		}
		else { uPlotOptions = options; }

		var uPlotData = data;

		if(uPlotData.length < series.length - 1){ //Append dummy data if none or not enough found
			while(uPlotData.length < series.length - 1){
				if(uPlotData.length > 0) {
					uPlotData.push([new Array(uPlotData[0].length).fill(Math.random())]);
				}
				else {
					uPlotData.push([new Array(100).fill(0)]);
				}
			}
		}
		else if (uPlotData.length > series.length) {
			uPlotData.splice(series.length, uPlotData.length - series.length);
		}

		//console.log(uPlotData);

		if(this.plot !== null){ this.plot.destroy(); }
		
		this.plot = new uPlot(uPlotOptions, uPlotData, document.getElementById(this.canvasId));
	}

	//Pass this the channelTags object from your eeg32 instance.
	makeSeriesFromChannelTags(channelTags) { 
		var newSeries = [{}];
		channelTags.forEach((row,i) => {
			if(row.viewing === true) {
			  newSeries.push({
				label:"A"+row.ch + ", Tag: "+row.tag,
				value: (u, v) => v == null ? "-" : v.toFixed(1),
				stroke: "rgb("+Math.random()*255+","+Math.random()*255+","+Math.random()*255+")"
			  });
			}
		  });
		return newSeries;
	}

	updateData(data) { // [x,y0,y1,y2,etc]
		this.plot.setData(data);
	}

	//Stacked uplot with dynamic y scaling per series. Define either series or channelTags (from the eeg32 instance)
	makeStackeduPlot = (series=[{}], data=[], options = null, channelTags = null) => {
		var newSeries = [{}];
		var serieslen = 0;
		if(series === newSeries) {
			if(channelTags === null) { console.log("No series data!"); return; }
			serieslen = channelTags.length;
		}
		var yvalues;
		
		var windows = [];
		var maxs = [];
		var mins = [];

		var dat = data;

		if((dat.length === 0)) { //No data
			console.log("No data inputted!");
			return;
		}

		dat.forEach((row,i) => {
			if(i>0){
				windows.push(Math.ceil(Math.max(...row)) - Math.min(...row));
				mins.push(Math.min(...row));
				maxs.push(Math.max(...row));
		  	}
		});

		var max = Math.max(...windows);


		var mapidx=0;
		
		var ymapper = (t,j) => { //Pushes the y values up based on the max peak values of all the previous signals inputted
			var k = 0;
			var sum = 0;
			while(k < mapidx){
				sum += 1;
				k++;
			}
			if(mins[mapidx] < 0) {
				sum += Math.abs(mins[k])/max;
			}
			return (t/max) + sum; //+(Math.abs(min)/max); //+0.5
		   
		}

		var uPlotData = [
			dat[0]
		];

		dat.forEach((row,i) => {
			if(i>0){
				uPlotData.push(row.map((t,j) => ymapper(t,j)));
				mapidx++;
			}
		  });

		var datidx = 1;

		if(channelTags !== null) {
			channelTags.forEach((row,i) => {
				if(row.viewing === true) {
	
				var r = Math.random()*255; var g = Math.random()*255; var b = Math.random()*255;
				var newLineColor = "rgb("+r+","+g+","+b+")";
				var newFillColor = "rgba("+r+","+g+","+b+",0.1)"
				
				var valuemapper = (u,v,ser,i) => {
					if(v === null) {
						return "-";
					}
					else {
						//console.log(v)
						return dat[ser-1][i].toFixed(1);
					}
				}
	
				newSeries.push({
					label:"A"+row.ch + ", Tag: "+row.tag,
					stroke: newLineColor,
					value: valuemapper,
					fill: newFillColor,
					fillTo: (u,v) => v-1
				});
				
				datidx++;
				}  
			});
		}
		else{
			newSeries = series;
		}

		//console.log(newSeries)
		
		yvalues = (u, splits) => splits.map((v,i) => axmapper(v,i));

		var ax=-1;
		var axmapper = (v,i) => {
		  if(v === Math.floor(v)){
			if(v < newSeries.length){
			  ax++;
			  return newSeries[v].label;
			}
		  }
		  else{ return (((v-ax)*(max)+mins[ax])).toFixed(1);}
		}
		
		var uPlotOptions;
		if(options === null){
		uPlotOptions = {
		  title: "EEG Output",
		  width: 1000,
		  height: 800,
		  series: newSeries,
		  axes: [
			{
			scale: "sec",
			values: (u, vals, space) => vals.map(v => +v.toFixed(1) + "s"),
			},
			{
			  size: 80,
			  values: yvalues
			}
		  ]
		}
		}
		else { uPlotOptions = options; }

		if(this.plot !== null) { this.plot.destroy();}
		this.plot = new uPlot(uPlotOptions, uPlotData, document.getElementById(this.canvasId));
		
	}

	updateStackedData(dat) {
		
		var mapidx=0;
		
		var ymapper = (t,j) => { //Pushes the y values up based on the max peak values of all the previous signals inputted
			var k = 0;
			var sum = 0;
			while(k < mapidx){
				sum += 1;
				k++;
			}
			if(mins[mapidx] < 0) {
				sum += Math.abs(mins[k])/max;
			}
			return (t/max) + sum; //+(Math.abs(min)/max); //+0.5
		   
		}

		var uPlotData = [
			dat[0]
		];

		dat.forEach((row) => {
			uPlotData.push(row.map((t,j) => ymapper(t,j)));
			mapidx++;
		  });

		this.plot.setData(uPlotData);
	}

}


//heatmap-js based brain mapping with active channel markers (incl assigned ADC input), based on the atlas system in eeg32
export class brainMap2D {
	constructor(heatmapCanvasId = null, pointsCanvasId = null) {
		if(typeof(createWebGLHeatmap) === 'undefined'){
			console.log("webgl-heatmap.js not found! Please include in your app correctly");
			return false;
		}

		this.heatmapCanvasId = heatmapCanvasId;
		this.pointsCanvasId = pointsCanvasId;
		this.anim = null;

		this.heatmap = null;
		this.pointsCanvas = null;
		this.pointsCtx = null;

		if((heatmapCanvasId !== null) && (pointsCanvasId !== null)) {
			this.heatmap = createWebGLHeatmap({canvas: document.getElementById(this.heatmapCanvasId), intensityToAlpha: true});	
			this.pointsCanvas = document.getElementById(this.pointsCanvasId);
			this.pointsCtx = this.pointsCanvas.getContext("2d"); 
		}

		this.points = [{ x:100, y:100, size:100, intensity: 0.7 }];
		this.scale = 1.5; // heatmap scale

	}

	deInit() {
		cancelAnimationFrame(anim);
		this.anim = "cancel";
	}

	init() {
		this.anim = requestAnimationFrame(draw);
	}

	genHeatMap(heatmapCanvasId=this.heatmapCanvasId, pointsCanvasId=this.pointsCanvasId) {
		this.heatmap = createWebGLHeatmap({canvas: document.getElementById(heatmapCanvasId), intensityToAlpha: true});	
		this.pointsCanvas = document.getElementById(pointsCanvasId);
		this.pointsCanvas.width = this.heatmap.width;
		this.pointsCanvas.height = this.heatmap.height;
		this.pointsCtx = this.pointsCanvas.getContext("2d"); 
	}

	updateHeatmap(points=this.points) {
		this.heatmap.clear();
		this.heatmap.addPoints(points);
		this.heatmap.update();
		this.heatmap.display();
	}

	updateHeatmapFromAtlas(atlas, channelTags, viewing) {
		var points = [];
		
		var width = this.pointsCanvas.width;
		var height = this.pointsCanvas.height;

		channelTags.forEach((row,i) => {
			let atlasCoord = atlas.map.find((o, j) => {
			  if(o.tag === row.tag){
				points.push({x:o.data.x*1.5+width*.5, y:height*.5-o.data.y*1.5, size:10, intensity:0.7});
				if(viewing === "scp"){
					points[points.length - 1].size = o.data.means.scp[o.data.means.scp.length - 1];
				  }
				else if(viewing === "delta"){
				  points[points.length - 1].size = o.data.means.delta[o.data.means.delta.length - 1];
				}
				else if(viewing === "theta"){
				  points[points.length - 1].size = o.data.means.theta[o.data.means.theta.length - 1];
				}
				else if(viewing === "alpha"){
				  points[points.length - 1].size = o.data.means.alpha[o.data.means.alpha.length - 1];
				}
				else if(viewing === "beta"){
				  points[points.length - 1].size = o.data.means.beta[o.data.means.beta.length - 1];
				}
				else if(viewing === "gamma"){
				  points[points.length - 1].size = o.data.means.gamma[o.data.means.gamma.length - 1];
				}
				points[points.length - 1].size *= 10; //Need a better method
	
				//simplecoherence *= points[points.length-1].size;
				if(points[points.length - 1].size > 135){
				  points[points.length - 1].size = 135;
				}
			  }
			});
		  });
		//console.log(points)
		this.points = points;
		this.heatmap.clear();
		this.heatmap.addPoints(this.points); //update size and intensity
		this.heatmap.update();
		this.heatmap.display();
	}

	//pass this the atlas and channelTags from your eeg32 instance
	updatePointsFromAtlas(atlas,channelTags,clear=true) {
		
		var halfwidth = this.pointsCanvas.width*.5;
		var halfheight = this.pointsCanvas.height*.5;
		
		if(clear === true){
			this.pointsCtx.fillStyle = "rgba(0,0,0,0)";
			this.pointsCtx.clearRect(0, 0, this.pointsCanvas.width, this.pointsCanvas.height);
		}
		
		atlas.map.forEach((row,i) => {
			this.pointsCtx.beginPath();
			this.pointsCtx.fillStyle="rgba(0,0,255,1)";
		  let tags = channelTags.find((o, i) => {
			if(o.tag === row.tag){
				this.pointsCtx.fillStyle = "rgba(0,0,0,0.7)";
				this.pointsCtx.fillText(o.ch,halfwidth-15+row.data.x*this.scale,halfheight+10-row.data.y*this.scale,14);
				this.points[i] = { x: row.data.x, y: row.data.y, size: 10, intensity: 0.7 };
				this.pointsCtx.fillStyle="rgba(0,255,0,1)";
			  return true;
			}
		  });
		  // Draws a circle at the coordinates on the canvas
		  this.pointsCtx.arc(halfwidth+row.data.x*this.scale, halfheight-row.data.y*this.scale, 4, 0, Math.PI*2, true); 
		  this.pointsCtx.closePath();
		  this.pointsCtx.fill();
  
		  this.pointsCtx.fillStyle = "rgba(0,0,0,0.7)";
		  this.pointsCtx.fillText(row.tag,halfwidth+4+row.data.x*this.scale,halfheight+10-row.data.y*this.scale,14);
		});
	}

	updateConnectomeFromAtlas(coherenceMap, atlas, channelTags, clear=true) {
		var halfwidth = this.pointsCanvas.width*.5;
		var halfheight = this.pointsCanvas.height*.5;
		var ctx = this.pointsCtx;

		if(clear === true){
			ctx.fillStyle = "rgba(0,0,0,0)";
			ctx.clearRect(0, 0, this.pointsCanvas.width, this.pointsCanvas.height);
		}

		coherenceMap.map.forEach((row,i) => {
			ctx.beginPath();
			ctx.moveTo(halfwidth+row.data.x0,halfheight+row.data.y0);
			ctx.lineTo(halfwidth+row.data.x1,halfheight+row.data.y1);
			ctx.stroke();
		});

		//Now redraw points on top of connectome
		this.updatePointsFromAtlas(atlas, channelTags, false);
	}

	draw = () => {
		this.heatmap.clear();
		this.heatmap.addPoints(this.points); //update size and intensity
		this.heatmap.update();
		this.heatmap.display();
		setTimeout(() => {if(this.anim !== "cancel") this.anim = requestAnimationFrame(draw)},20); // 50 FPS hard limit
	}
}


//Makes a color coded bar chart to apply frequency bins to for a classic visualization
export class eegBarChart {
	constructor(canvasId = null) {
		this.canvas = canvasId;
		this.anim = null;

	}

	deInit() {
		cancelAnimationFrame(anim);
		this.anim = "cancel";
	}

	init() {
		this.anim = requestAnimationFrame(draw);
	}

	draw = () => {

		setTimeout(() => {if(this.anim !== "cancel") this.anim = requestAnimationFrame(draw)},20); // 50 FPS hard limit
	}
}


export class thetaGamma2Octave {
	constructor(canvasId = null) {
		this.canvas = canvasId;
		this.anim = null;

		this.audioctx = new SoundJS();
	}

	deInit() {
		cancelAnimationFrame(anim);
		this.anim = "cancel";
	}

	init() {
		this.anim = requestAnimationFrame(draw);
	}

	draw = () => {
		setTimeout(() => {if(this.anim !== "cancel") this.anim = requestAnimationFrame(draw)},20); // 50 FPS hard limit
	}
}



//---------------------------------------------------------------------------------
//---------------------------------------------------------------------------------
//-------------------------------EEG UX Utilities----------------------------------
//---------------------------------------------------------------------------------
//---------------------------------------------------------------------------------




//Parse Audio file buffers
export class BufferLoader { //From HTML5 Rocks tutorial
	constructor(ctx, urlList, callback){
	 this.ctx = ctx;
	 this.urlList = urlList;
	 this.onload = callback;
	 this.bufferList = new Array();
	 this.loadCount = 0;
	}
 
	loadBuffer(url='',index){
	 // Load buffer asynchronously
	 var request = new XMLHttpRequest();
	 request.responseType = "arraybuffer";
	 var responseBuf = null;
	 
	 if((url.indexOf("http://") != -1) || (url.indexOf("file://") != -1)){
		 request.open("GET", url, true);
		 request.onreadystatechange = () => {
		   if(request.readyState === 4){
			 if(request.status === 200 || request.status == 0){
			   responseBuf = request.response; //Local files work on a webserver with request
			 }
		   }
		 }
	   var loader = this;
 
	   request.onload = function() {
		 // Asynchronously decode the audio file data in request.response
		 loader.ctx.decodeAudioData(
		   responseBuf,
		   function(buffer) {
			 if (!buffer) {
			   alert('error decoding file data: ' + url);
			   return;
			 }
			 loader.bufferList[index] = buffer;
			 if (++loader.loadCount == loader.urlList.length)
			   loader.onload(loader.bufferList);
		   },
		   function(error) {
			 console.error('decodeAudioData error: ', error);
		   }
		 );
	   }
	   request.onerror = function() {
		 alert('BufferLoader: XHR error');
	   }
	 
	   request.send();
	 }
	 else{//Local Audio
	   //read and decode the file into audio array buffer 
	   var loader = this;
	   var fr = new FileReader();
	   fr.onload = function(e) {
		   var fileResult = e.target.result;
		   var audioContext = loader.ctx;
		   if (audioContext === null) {
			   return;
		   }
		   console.log("Decoding audio...");
		   audioContext.decodeAudioData(fileResult, function(buffer) {
			 if (!buffer) {
			   alert('Error decoding file data: ' + url);
			   return;
			 }
			 else{
			   console.log('File decoded successfully!')
			 }
			 loader.bufferList[index] = buffer;
			 if (++loader.loadCount == loader.urlList.length)
			   loader.onload(loader.bufferList);
			 },
			 function(error) {
			   console.error('decodeAudioData error: ', error);
			 }
		   );
	   }
	   fr.onerror = function(e) {
		   console.log(e);
	   }
	   
	   var input = document.createElement('input');
	   input.type = 'file';
	   input.multiple = true;
 
	   input.onchange = e => {
		 fr.readAsArrayBuffer(e.target.files[0]);
		 input.value = '';
		 }
	   input.click();
	 }
 
   }
 
   load(){
	 for (var i = 0; i < this.urlList.length; ++i)
	 this.loadBuffer(this.urlList[i], i);
   }
   
 }
 
 //Audio file playing, sound synthesis, and media recording.
 export class SoundJS { //Only one Audio context at a time!
   constructor(){
	 window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
	 
	 this.ctx = null;
	 try {
	   this.ctx = new AudioContext();
	 } catch (e) {
	   alert("Your browser does not support AudioContext!");
	   console.log(e);
	 } 
	 
	 this.sourceList = [];
	 
	 this.recordedData = [];
	 this.recorder = null;
	 this.buffer = [];
 
	 this.osc = [];
	 this.gain = this.ctx.createGain();
	 this.analyser = this.ctx.createAnalyser();
	 this.out = this.ctx.destination;
	 this.gain.connect(this.analyser)
	 this.analyser.connect(this.out);
	 
   }
 
   //Play arrays of frequencies with the given waveform and duration. 0 = endless sound. call playFreq multiple times with different waveforms for simple sound synthesis
   playFreq(freq=[1000], seconds=0, type='sine', startTime=this.ctx.currentTime){ //Oscillators are single use items. Types: sine, square, sawtooth, triangle, or custom via setPeriodicWave()
	 freq.forEach((element)=>{
	   var len = this.osc.length;
		 this.osc[len] = this.ctx.createOscillator();
		 this.osc[len].start();
		 this.osc[len].onended = () => {
		   this.osc.splice(len,1);
		 }
	   this.osc[len].type = type;
	   this.osc[len].connect(this.gain);
	   this.osc[len].frequency.setValueAtTime(element, startTime);
	   if(seconds!=0){
		 //0 = unlimited 
		 this.osc[len].stop(startTime+seconds);
	   }
	 });
   }
 
   stopFreq(firstIndex=0, number=1, delay=0){//Stops and removes the selected oscillator(s). Can specify delay.
	 for(var i = firstIndex; i<number; i++){
	   if(this.osc[oscIndex]){
		 this.osc[oscIndex].stop(this.ctx.currentTime+delay);
	   }
	   else{
		 console.log("No oscillator found.")
	   }
	 }
   }
 
   finishedLoading = (bufferList) => {
	 bufferList.forEach((element) => {
	   this.sourceList.push(this.ctx.createBufferSource()); 
	   var idx = this.sourceList.length - 1;
	   this.sourceList[idx].buffer = element;
	   this.sourceList[idx].onended = () => {this.sourceList.splice(idx, 1)};
	   this.sourceList[idx].connect(this.gain); //Attach to volume node
	 });
   }
 
   addSounds(urlList=['']){
	 var bufferLoader = new BufferLoader(this.ctx, urlList, this.finishedLoading)
	 bufferLoader.load();
   }
 
   playSound(bufferIndex, seconds=0, repeat=false, startTime=this.ctx.currentTime){//Plays sounds loaded in buffer by index. Sound buffers are single use items.
	 if(repeat == true){
	   this.sourceList[bufferIndex].loop = true;
	 }
	 
	 this.sourceList[bufferIndex].start(startTime);
	 if(seconds != 0){
	   this.sourceList[bufferIndex].stop(startTime+seconds);
	 }
   }
 
   stopSound(bufferIndex){
	 this.sourceList[bufferIndex].stop(0);
   }
 
   setPlaybackRate(bufferIndex, rate){
	 this.sourceList[bufferIndex].playbackRate.value = rate;
   }
 
   record(name = new Date().toISOString(), args={audio:true, video:false}, type=null, streamElement=null){ // video settings vary e.g. video:{width:{min:1024,ideal:1280,max:1920},height:{min:576,ideal:720,max:1080}}
	 /*
	 navigator.mediaDevices.enumerateDevices().then((devices) => {
	   devices = devices.filter((d) => d.kind === 'audioinput');
	   devices.forEach(function(device) {
		 let menu = document.getElementById("inputdevices");
		 if (device.kind == "audioinput") {
		   let item = document.createElement("option");
		   item.innerHTML = device.label;
		   item.value = device.deviceId;
		   menu.appendChild(item);
		   }
	   });
	 }); //Device selection
 
	 navigator.permissions.query({name:'microphone'}).then(function(result) {
	   if (result.state == 'granted') {
 
	   } else if (result.state == 'prompt') {
 
	   } else if (result.state == 'denied') {
 
	   }
	   result.onchange = function() {
 
	   };
	 });
	 */
	 var supported = null;
	 var ext = null;
	 var types = type;
	 if(types==null){
	   if(args.video != false){
		 types = [
		   'video/webm',
		   'video/webm;codecs=vp8',
		   'video/webm;codecs=vp9',
		   'video/webm;codecs=vp8.0',
		   'video/webm;codecs=vp9.0',
		   'video/webm;codecs=h264',
		   'video/webm;codecs=H264',
		   'video/webm;codecs=avc1',
		   'video/webm;codecs=vp8,opus',
		   'video/WEBM;codecs=VP8,OPUS',
		   'video/webm;codecs=vp9,opus',
		   'video/webm;codecs=vp8,vp9,opus',
		   'video/webm;codecs=h264,opus',
		   'video/webm;codecs=h264,vp9,opus',
		   'video/x-matroska;codecs=avc1'
		 ];
		 }
	   else if(args.audio == true){
		 types = [
		   'audio/wav', // might be supported native, otherwise see:
		   'audio/mp3', // probably not supported
		   'audio/webm',
		   'audio/webm;codecs=opus',
		   'audio/webm;codecs=pcm',
		   'audio/ogg',
		   'audio/x-matroska' // probably not supported
		 ];
	   }
	 }
 
	 for(var i=0; i<types.length; i++){
	   if(MediaRecorder.isTypeSupported(types[i]) == true){
		 supported = types[i];
		 console.log("Supported type: ", supported);
		 if(types[i].indexOf('webm') != -1){
		   ext = '.webm';
		 }
		 if(types[i].indexOf('ogg') != -1){
		   ext = '.ogg';
		 }
		 if(types[i].indexOf('mp3') != -1){
		   ext = '.mp3';
		 }
		 if(types[i].indexOf('wav') != -1){
		   ext = '.wav';
		 }
		 if(types[i].indexOf('x-matroska') != -1){
		   ext = '.mkv';
		 }
		 break;
	   }
	 }
 
	 if(supported != null){
	   function errfunc(e) {
		 console.log(e);
	   } 
 
	   navigator.mediaDevices.getUserMedia(args).then((recordingDevice) => { //Get
		 console.log("Media stream created.");
		 
		 if(streamElement != null){ // attach to audio or video element, or Audio(). For canvas, use an AudioContext analyzer.
		   streamElement.src = window.URL.createObjectURL(recordingDevice);
		 }
 
		 this.recorder = new MediaRecorder(recordingDevice);
 
		 this.recorder.onstop = (e) => {
		   console.log("Media recorded, saving...");
 
		   var blob = new Blob(this.recordedData, {
			 type: supported
		   });
 
		   var url = URL.createObjectURL(blob);
		   var a = document.createElement("a");
		   document.body.appendChild(a);
		   a.style = "display: none";
		   a.href = url;
		   a.download = name + ext;
		   a.click();
		   window.URL.revokeObjectURL(url);
		 }
		 
		 this.recorder.ondataavailable = (e) => {
		   this.recordedData.push(e.data);
		 }
 
		 this.recorder.start(); //Begin recording
 
	   }, errfunc);
 
	 }
	 else {
	   alert("Cannot record! Check function call settings, ensure browser is compatible.");
	 }
   }
 
   replayRecording(streamElement) { //Replay the currently buffered recording in an acceptable stream element, e.g. attach to audio or video element, or an Audio() class, or a video element. For canvas, use an AudioContext analyzer.
	 if(this.recordedData.length > 1){
	   this.buffer = new Blob(this.recordedData);
	   streamElement.src = window.URL.createObjectURL(buffer);
	 }
   }
 
  }
  
 export class geolocateJS {
	 constructor(){
	   if(navigator.geolocation){
		 
	   }
	   else{
		 alert("Geolocation not supported in this browser!");
	   }
 
	   this.locationData=[];
	 }
 
	 showPosition(position){
	   //alert("Lat: "+position.coords.latitude+", Lon: "+position.coords.longitude);
	   this.locationData.push(new Date().toISOString()+","+position.coords.latitude+","+position.coords.longitude);
	 }
 
	 getPosition(){
	   navigator.geolocation.getCurrentPosition(this.showPosition);
	 }
 
  }