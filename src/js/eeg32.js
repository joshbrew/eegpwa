//Joshua Brewster, AGPL (copyleft)

import 'regenerator-runtime/runtime' //For async functions on node\\

export class eeg32 { //Contains structs and necessary functions/API calls to analyze serial data for the FreeEEG32
    constructor() {
		
        //Free EEG 32 data structure:
        /*
            [stop byte, start byte, counter byte, 32x3 channel data bytes (24 bit), 3x2 accelerometer data bytes, stop byte, start byte...] 
            Total = 105 bytes/line
        */
        this.buffer = []; 
        this.startByte = 160; // Start byte value
		this.stopByte = 192; // Stop byte value
		this.searchString = new Uint8Array([this.stopByte,this.startByte]); //Byte search string
		
		this.sps = 512; // Sample rate
		this.nChannels = 32; // 24 bit channels, 3 bytes each
		this.nPeripheralChannels = 6; // accelerometer and gyroscope (2 bytes * 3 coordinates each)
		this.updateMs = 1000/this.sps; //even spacing
		
		this.data = { //Data object to keep our head from exploding. Get current data with e.g. this.data.A0[this.data.counter-1]
			counter: 0,
			ms: [0],
			'A0': [],'A1': [],'A2': [],'A3': [],'A4': [],'A5': [],'A6': [],'A7': [], //ADC 0
			'A8': [],'A9': [],'A10': [],'A11': [],'A12': [],'A13': [],'A14': [],'A15': [], //ADC 1
			'A16': [],'A17': [],'A18': [],'A19': [],'A20': [],'A21': [],'A22': [],'A23': [], //ADC 2
			'A24': [],'A25': [],'A26': [],'A27': [],'A28': [],'A29': [],'A30': [],'A31': [], //ADC 3
			'Ax': [], 'Ay': [], 'Az': [], 'Gx': [], 'Gy': [], 'Gz': []  //Peripheral data (accelerometer, gyroscope)
		}

		this.atlas = null; //this.makeAtlas10_20();
		this.channelTags = null; //Format: [{ch:0, tag:"Fp1", viewing:true},{etc}];

		//navigator.serial utils
		if(!navigator.serial){
			alert("navigator.serial not found! Enable #enable-experimental-web-platform-features in chrome://flags (search 'experimental')")
		}
		this.port = null;

    }
	
    bytesToInt16(x0,x1){
		return x0 * 256 + x1;
    }

    int16ToBytes(y){ //Turns a 24 bit int into a 3 byte sequence
        return [y & 0xFF , (y >> 8) & 0xFF];
    }

    bytesToInt24(x0,x1,x2){ //Turns a 3 byte sequence into a 24 bit int
        return x0 * 65536 + x1 * 256 + x2;
    }

    int24ToBytes(y){ //Turns a 24 bit int into a 3 byte sequence
        return [y & 0xFF , (y >> 8) & 0xFF , (y >> 16) & 0xFF];
    }

    decode(buffer = this.buffer) { //returns true if successful, returns false if not
		
		var needle = this.searchString
		var haystack = buffer;
		var search = this.boyerMoore(needle);
		var skip = search.byteLength;
		var indices = [];

		for (var i = search(haystack); i !== -1; i = search(haystack, i + skip)) {
			indices.push(i);
		}
		//console.log(indices);

		if(indices.length >= 2){
			var line = buffer.splice(indices[0],indices[1]-indices[0]); //Splice out this line to be decoded

			// line[0] = stop byte, line[1] = start byte, line[2] = counter, line[3:99] = ADC data 32x3 bytes, line[100-104] = Accelerometer data 3x2 bytes
			
			if(indices[1] - indices[0] !== 105) {buffer.splice(0,indices[1]); return false;} //This is not a valid sequence going by size, drop sequence and return
			
			if(indices[0] !== 0){
				buffer.splice(0,indices[0]); // Remove any useless junk on the front of the buffer.		
			}

			//line found, decode.
			this.data.counter++; 
			this.data.ms.push(this.data.ms[this.data.ms.length - 1]+this.updateMs);//Assume no dropped samples 

			for(var i = 3; i < 99; i+=3) {
				var channel = "A"+(i-3)/3;
				this.data[channel].push(this.bytesToInt24(line[i],line[i+1],line[i+2]));
			}

			this.data["Ax"].push(this.bytesToInt16(line[99],line[100]));
			this.data["Ay"].push(this.bytesToInt16(line[101],line[102]));
			this.data["Az"].push(this.bytesToInt16(line[103],line[104])); 

			return true;
			//Continue
		}
		else {this.buffer = []; return false;} 
	}

	//Callbacks
	onDecoded(){
		//console.log("new data!");
	}

	onConnectedCallback() {
		console.log("port connected!");
	}

	onReceive(value){
		this.buffer.push(...value);

		while (this.buffer.length > 209) {
			//console.log("decoding... ", this.buffer.length)
			this.decode();	
		}
		this.onDecoded();
	}

	async onPortSelected(port,baud) {
		try {await port.open({ baudRate: baud, bufferSize: 65536 });} //API inconsistency in syntax between linux and windows
		catch {await port.open({ baudrate: baud, bufferSize: 65536});}
		this.onConnectedCallback();
		this.subscribe(port);
	}

	async subscribe(port){
		while (this.port.readable) {
			const reader = port.readable.getReader();
			try {
				while (true) {
				//console.log("reading...");
				const { value, done } = await reader.read();
				if (done) {
					// Allow the serial port to be closed later.
					reader.releaseLock();
					break;
				}
				if (value) {
					this.onReceive(value);
					//console.log(this.decoder.decode(value));
				}
				}
			} catch (error) {
				console.log(error);// TODO: Handle non-fatal read error.
				break;
			}
		}
	}

	async closePort() {
		await this.port.close();
		this.port = null; 
	}

	async setupSerialAsync(baudrate=921600) { //You can specify baudrate just in case

		const filters = [
			{ usbVendorId: 0x10c4, usbProductId: 0x0043 } //CP2102 filter (e.g. for UART via ESP32)
		];
		
		this.port = await navigator.serial.requestPort();
		navigator.serial.addEventListener("disconnect",(e) => {
			this.closePort();
		})
		this.onPortSelected(this.port,baudrate);
		
	}

		
	//Boyer Moore fast byte search method copied from https://codereview.stackexchange.com/questions/20136/uint8array-indexof-method-that-allows-to-search-for-byte-sequences
	asUint8Array(input) {
		if (input instanceof Uint8Array) {
			return input;
		} else if (typeof(input) === 'string') {
			// This naive transform only supports ASCII patterns. UTF-8 support
			// not necessary for the intended use case here.
			var arr = new Uint8Array(input.length);
			for (var i = 0; i < input.length; i++) {
			var c = input.charCodeAt(i);
			if (c > 127) {
				throw new TypeError("Only ASCII patterns are supported");
			}
			arr[i] = c;
			}
			return arr;
		} else {
			// Assume that it's already something that can be coerced.
			return new Uint8Array(input);
		}
	}

	boyerMoore(patternBuffer) {
		// Implementation of Boyer-Moore substring search ported from page 772 of
		// Algorithms Fourth Edition (Sedgewick, Wayne)
		// http://algs4.cs.princeton.edu/53substring/BoyerMoore.java.html
		/*
		USAGE:
			// needle should be ASCII string, ArrayBuffer, or Uint8Array
			// haystack should be an ArrayBuffer or Uint8Array
			var search = boyerMoore(needle);
			var skip = search.byteLength;
			var indices = [];
			for (var i = search(haystack); i !== -1; i = search(haystack, i + skip)) {
				indices.push(i);
			}
		*/
		var pattern = this.asUint8Array(patternBuffer);
		var M = pattern.length;
		if (M === 0) {
			throw new TypeError("patternBuffer must be at least 1 byte long");
		}
		// radix
		var R = 256;
		var rightmost_positions = new Int32Array(R);
		// position of the rightmost occurrence of the byte c in the pattern
		for (var c = 0; c < R; c++) {
			// -1 for bytes not in pattern
			rightmost_positions[c] = -1;
		}
		for (var j = 0; j < M; j++) {
			// rightmost position for bytes in pattern
			rightmost_positions[pattern[j]] = j;
		}
		var boyerMooreSearch = (txtBuffer, start, end) => {
			// Return offset of first match, -1 if no match.
			var txt = this.asUint8Array(txtBuffer);
			if (start === undefined) start = 0;
			if (end === undefined) end = txt.length;
			var pat = pattern;
			var right = rightmost_positions;
			var lastIndex = end - pat.length;
			var lastPatIndex = pat.length - 1;
			var skip;
			for (var i = start; i <= lastIndex; i += skip) {
				skip = 0;
				for (var j = lastPatIndex; j >= 0; j--) {
				var c = txt[i + j];
				if (pat[j] !== c) {
					skip = Math.max(1, j - right[c]);
					break;
				}
				}
				if (skip === 0) {
				return i;
				}
			}
			return -1;
		};
		boyerMooreSearch.byteLength = pattern.byteLength;
		return boyerMooreSearch;
	}
	//---------------------end copy/pasted solution------------------------

	//EEG Atlas generator
	newCoord(x,y,z, times=[], amplitudes=[], slices= {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means={delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}){
		return {x: x, y:y, z:z, times:times, amplitudes:amplitudes, slices:slices, means:means};
	}

	//Input arrays of corresponding tags, xyz coordinates as Array(3) objects, and DFT amplitudes (optional).
	newAtlas(tags=["Fp1","Fp2"], coords = [[-21.5, 70.2,-0.1],[28.4,69.1,-0.4]],times=undefined,amplitudes=undefined,slices=null, means=null){
		var newLayout = {shared: {sps: this.sps, bandPassWindows:[]}, map:[]}
		tags.forEach((tag,i) => {
			if (amplitudes === undefined) {
				newLayout.map.push({tag: tag, data: this.newCoord(coords[i][0],coords[i][1],coords[i][2],undefined,undefined,undefined,undefined)});
			}
			else{
				newLayout.map.push({tag: tag, data: this.newCoord(coords[i][0],coords[i][1],coords[i][2],times[i],amplitudes[i],slices[i],means[i])});
			}
		});
		return newLayout;
	}

	//Return the object corresponding to the atlas tag
	getAtlasCoordByTag(tag="Fp1"){
		var found = undefined;
		let atlasCoord = atlas.map.find((o, i) => {
			if(o.tag === tag){
				found = o;
				return true;
			}
		});
		return found;
	}

	//Returns an array of Array(3)s for each coordinate. Useful e.g. for graphics
	getAtlasCoordsList(fromAtlas) {
		var coords = [];
		for(var i = 0; i< fromAtlas.length; i++) {
		  coords.push([fromAtlas.map[i].data.x,fromAtlas.map[i].data.y,fromAtlas.map[i].data.z]);
		 
		}
		return coords;
	}

	//Returns a 10_20 atlas object with structure { "Fp1": {x,y,z,amplitudes[]}, "Fp2" : {...}, ...}
	makeAtlas10_20(){
		// 19 channel coordinate space spaghetti primitive. 
		// Based on MNI atlas. 
		return {shared: {sps: this.sps, bandPassWindows:[], bandPassFreqs:{delta:[[],[]],theta:[[],[]], alpha:[[],[]], beta:[[],[]], gamma:[[],[]]} //x axis values and indices for named EEG frequency bands
		}, map:[
			{tag:"Fp1", data: { x: -21.5, y: 70.2,   z: -0.1,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"Fp2", data: { x: 28.4,  y: 69.1,   z: -0.4,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"Fz",  data: { x: 0.6,   y: 40.9,   z: 53.9,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"F3",  data: { x: -35.5, y: 49.4,   z: 32.4,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"F4",  data: { x: 40.2,  y: 47.6,   z: 32.1,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"F7",  data: { x: -54.8, y: 33.9,   z: -3.5,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"F8",  data: { x: 56.6,  y: 30.8,   z: -4.1,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},  
			{tag:"Cz",  data: { x: 0.8,   y: -14.7,  z: 73.9,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"C3",  data: { x: -52.2, y: -16.4,  z: 57.8,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"C4",  data: { x: 54.1,  y: -18.0,  z: 57.5,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}}, 
			{tag:"T3",  data: { x: -70.2, y: -21.3,  z: -10.7, times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"T4",  data: { x: 71.9,  y: -25.2,  z: -8.2,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"Pz",  data: { x: 0.2,   y: -62.1,  z: 64.5,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"P3",  data: { x: -39.5, y: -76.3,  z: 47.4,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}}, 
			{tag:"P4",  data: { x: 36.8,  y: -74.9,  z: 49.2,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"T5",  data: { x: -61.5, y: -65.3,  z: 1.1,   times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"T6",  data: { x: 59.3,  y: -67.6,  z: 3.8,   times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}},
			{tag:"O1",  data: { x: -26.8, y: -100.2, z: 12.8,  times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma:[0]}}},
			{tag:"O2",  data: { x: 24.1,  y: -100.5, z: 14.,   times: [], amplitudes: [], slices: {delta: [], theta: [], alpha: [], beta: [], gamma: []}, means: {delta: [0], theta: [0], alpha: [0], beta: [0], gamma: [0]}}} 
		]};

	}

	getBandFreqs(bandPassWindow) {//Returns an object with the frequencies and indices associated with the bandpass window (for processing the FFT results)
		var deltaFreqs = [[],[]], thetaFreqs = [[],[]], alphaFreqs = [[],[]], betaFreqs = [[],[]], gammaFreqs = [[],[]]; //x axis values and indices for named EEG frequency bands
		bandPassWindow.forEach((item,idx) => {
			if((item >= 0.5) && (item <= 4)){
			deltaFreqs[0].push(item); deltaFreqs[1].push(idx);
			}
			if((item > 4) && (item <= 8)) {
			thetaFreqs[0].push(item); thetaFreqs[1].push(idx);
			}
			if((item > 8) && (item <= 12)){
			alphaFreqs[0].push(item); alphaFreqs[1].push(idx);
			}
			if((item > 12) && (item <= 35)){
			betaFreqs[0].push(item); betaFreqs[1].push(idx);
			}
			if(item > 35) {
			gammaFreqs[0].push(item); gammaFreqs[1].push(idx);
			}
		});
		return {delta: deltaFreqs, theta: thetaFreqs, alpha: alphaFreqs, beta: betaFreqs, gamma: gammaFreqs}
	}
	
	//----------------------------------------------------------------
	//-------------------- Static Functions --------------------------
	//----------------------------------------------------------------

	//Generate sinewave, you can add a noise frequency in too. Array length will be Math.ceil(fs*nSec)
	static genSineWave(freq=20,peakAmp=1,nSec=1,fs=512,freq2=0,peakAmp2=1){
		var sineWave = [];
		var t = [];
		var increment = 1/fs; //x-axis time increment based on sample rate
		for (var ti = 0; ti < nSec; ti+=increment){ 
			var amplitude = Math.sin(2*Math.PI*freq*ti)*peakAmp;
			amplitude += Math.sin(2*Math.PI*freq2*ti)*peakAmp2; //Add interference
			sineWave.push(amplitude);
			t.push(ti);
		}
		return [t,sineWave]; // [[times],[amplitudes]]
	}

	static mean(arr){
		var sum = arr.reduce((prev,curr)=> curr += prev);
		return sum / arr.length;
	}

	static variance(arr1) { //1D input arrays of length n
		var mean1 = this.mean(arr1);
		var vari = [];
		for(var i = 0; i < arr1.length; i++){
			vari.push((arr1[i] - mean1)/(arr1.length-1));
		}
		return vari;
	}

	static transpose(mat){
		return mat[0].map((_, colIndex) => mat.map(row => row[colIndex]));
	}

	//Matrix multiplication from: https://stackoverflow.com/questions/27205018/multiply-2-matrices-in-javascript
	static matmul(a, b) {
		var aNumRows = a.length, aNumCols = a[0].length,
			bNumRows = b.length, bNumCols = b[0].length,
			m = new Array(aNumRows);  // initialize array of rows
		for (var r = 0; r < aNumRows; ++r) {
		  m[r] = new Array(bNumCols); // initialize the current row
		  for (var c = 0; c < bNumCols; ++c) {
			m[r][c] = 0;             // initialize the current cell
			for (var i = 0; i < aNumCols; ++i) {
			  m[r][c] += a[r][i] * b[i][c];
			}
		  }
		}
		return m;
	  }

	//2D matrix covariance (e.g. for lists of signals). Pretty fast!!!
	static cov2d(mat) { //[[x,y,z,w],[x,y,z,w],...] input list of vectors of the same length
		//Get variance of rows and columns
		//console.time("cov2d");
		var mattransposed = this.transpose(mat);
		console.log(mattransposed)
		var matproducts = [];

		var rowmeans = [];
		var colmeans = [];
		
		mat.forEach((row, idx) => {
			rowmeans.push(this.mean(row));
		});

		mattransposed.forEach((col,idx) => {
			colmeans.push(this.mean(col));
		});

		mat.forEach((row,idx) => {
			matproducts.push([]);
			for(var col = 0; col < row.length; col++){
				matproducts[idx].push((mat[idx][col]-rowmeans[idx])*(mat[idx][col]-colmeans[col])/(row.length - 1));
			}
		});

		/*
			mat[y][x] = (x - rowAvg)*(x - colAvg) / (mat[y].length - 1);
		*/
		
		console.log(matproducts);
		//Transpose matrix
		var matproductstransposed = this.transpose(matproducts);

		//Matrix multiplication, stolen from: https://stackoverflow.com/questions/27205018/multiply-2-matrices-in-javascript
		var aNumRows = matproducts.length, aNumCols = matproducts[0].length,
			bNumRows = matproductstransposed.length, bNumCols = matproductstransposed[0].length,
			m = new Array(aNumRows);  // initialize array of rows
		for (var r = 0; r < aNumRows; ++r) {
		  m[r] = new Array(bNumCols); // initialize the current row
		  for (var c = 0; c < bNumCols; ++c) {
			m[r][c] = 0;             // initialize the current cell
			for (var i = 0; i < aNumCols; ++i) {
			  m[r][c] += matproducts[r][i] * matproductstransposed[i][c] / (mat[0].length - 1); //divide by row length - 1
			}
		  }
		}
		//console.timeEnd("cov2d");
		return m; //Covariance matrix
	}

	//Covariance between two 1D arrays
	static cov1d(arr1,arr2) {
		return this.cov2d([arr1,arr2]);
	}

	//Simple cross correlation.
	static crosscorrelation(arr1,arr2) {

		//console.time("crosscorrelation");
		var arr2buf = [...arr2,...Array(arr2.length).fill(0)];
		var mean1 = this.mean(arr1);
		var mean2 = this.mean(arr2);

		//Estimators
		var arr1Est = arr1.reduce((sum,item) => sum += Math.pow(item-mean1,2));
		arr1Est = Math.sqrt(arr1Est);
		var arr2Est = arr2.reduce((sum,item) => sum += Math.pow(item-mean1,2));
		arr2Est = Math.sqrt(arr2Est);

		var arrEstsMul = arr1Est * arr2Est
		var correlations = [];

		arr1.forEach((x,delay) => {
			var r = 0;
			r += arr1.reduce((sum,item,i) => sum += (item - mean1)*(arr2buf[delay+i]-mean2));
			//arr1.forEach((y,i) => {
			//	r += (x - mean1) * (arr2buf[arr2.length+delay-i] - mean2);
			//})
			correlations.push(r/arrEstsMul);
		});

		//console.timeEnd("crosscorrelation");
		return correlations;
	}

	//Simple autocorrelation. Better method for long series: FFT[x1] .* FFT[x2]
	static autocorrelation(arr1) {
		console.time("autocorr");
		var delaybuf = [...arr1,...Array(arr1.length).fill(0)];
		var mean1 = this.mean(arr1);

		//Estimators
		var arr1Est = arr1.reduce((sum,item) => sum += Math.pow(item-mean1,2));
		arr1Est = Math.sqrt(arr1Est);

		var arr1estsqrd = arr1Est * arr1Est
		var correlations = [];

		arr1.forEach((x,delay) => {
			var r = 0;
			r += arr1.reduce((sum,item,i) => sum += (item - mean1)*(delaybuf[delay+i]-mean1));
			correlations.push(r/arr1estsqrd);
		});

		console.timeEnd("autocorr");
		return correlations;
	}

	//Input data and averaging window, output array of moving averages (should be same size as input array, initial values not fully averaged due to window)
	static sma(arr, window) {
		var smaArr = []; //console.log(arr);
		for(var i = 0; i < arr.length; i++) {
			if((i == 0)) {
				smaArr.push(arr[0]);
			}
			else if(i < window) { //average partial window (prevents delays on screen)
				var arrslice = arr.slice(0,i+1);
				smaArr.push(arrslice.reduce((previous,current) => current += previous ) / (i+1));
			}
			else { //average windows
				var arrslice = arr.slice(i-window,i);
				smaArr.push(arrslice.reduce((previous,current) => current += previous) / window);
			}
		} 
		//console.log(temp);
		return smaArr;
	}

}






//---------------------------------------------------------------------------------
//---------------------------------------------------------------------------------
//-------------------------------EEG Visual Classes--------------------------------
//---------------------------------------------------------------------------------
//---------------------------------------------------------------------------------

//Nice time series charts based on smoothiejs
export class SmoothieChartMaker {
	constructor(nSeries = 1, canvasId=null, gridStrokeStyle = 'rgb(125, 125, 125)', gridFillStyle = 'rgb(10, 10, 10)', labelFillStyle = 'rgb(255, 255, 255)') {
		if(typeof(SmoothieChart) === 'undefined'){
			alert("smoothie.js not found, please include it correctly before instantiating this class!");
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

//Lightweight plotter based on uplot.life.js
//TODO - big vertical chart comparing all channel data 
//E.g. y-shifted series https://leeoniya.github.io/uPlot/demos/y-shifted-series.html
//Other examples to draw from: https://leeoniya.github.io/uPlot/demos/resize.html
// https://leeoniya.github.io/uPlot/demos/draw-hooks.html
// https://leeoniya.github.io/uPlot/demos/latency-heatmap.html
export class uPlotMaker {
	constructor(canvasId = null) {
		if(typeof(uPlot) === 'undefined'){
			console.log("uPlot not detected! Make sure uplot.life.js and uplot.min.css are included in your app!");
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

		dat.forEach((row) => {
			uPlotData.push(row.map((t,j) => ymapper(t,j)));
			mapidx++;
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
				if(viewing === "delta"){
				  points[points.length - 1].size = o.data.means.delta;
				}
				else if(viewing === "theta"){
				  points[points.length - 1].size = o.data.means.theta;
				}
				else if(viewing === "alpha"){
				  points[points.length - 1].size = o.data.means.alpha;
				}
				else if(viewing === "beta"){
				  points[points.length - 1].size = o.data.means.beta;
				}
				else if(viewing === "gamma"){
				  points[points.length - 1].size = o.data.means.gamma;
				}
				points[points.length - 1].size *= 0.001; //Need a better method
	
				//simplecoherence *= points[points.length-1].size;
				if(points[points.length - 1].size > 135){
				  points[points.length - 1].size = 135;
				}
			  }
			});
		  });
		this.points = points;
		this.heatmap.clear();
		this.heatmap.addPoints(this.points); //update size and intensity
		this.heatmap.update();
		this.heatmap.display();
	}

	//pass this the atlas and channelTags from your eeg32 instance
	updatePointsFromAtlas(atlas,channelTags) {
		
		var width = this.pointsCanvas.width;
		var height = this.pointsCanvas.height;
		
		this.pointsCtx.fillStyle = "rgba(0,0,0,0)";
		this.pointsCtx.clearRect(0, 0, width, height);
		
		
		atlas.map.forEach((row,i) => {
			this.pointsCtx.beginPath();
			this.pointsCtx.fillStyle="rgba(0,0,255,1)";
		  let tags = channelTags.find((o, i) => {
			if(o.tag === row.tag){
				this.pointsCtx.fillStyle = "rgba(0,0,0,0.7)";
				this.pointsCtx.fillText(o.ch,width*.5-15+row.data.x*this.scale,height*.5+10-row.data.y*this.scale,14);
				this.points[i] = { x: row.data.x, y: row.data.y, size: 10, intensity: 0.7 };
				this.pointsCtx.fillStyle="rgba(0,255,0,1)";
			  return true;
			}
		  });
		  // Draws a circle at the coordinates on the canvas
		  this.pointsCtx.arc(width*.5+row.data.x*this.scale, height*.5-row.data.y*this.scale, 4, 0, Math.PI*2, true); 
		  this.pointsCtx.closePath();
		  this.pointsCtx.fill();
  
		  this.pointsCtx.fillStyle = "rgba(0,0,0,0.7)";
		  this.pointsCtx.fillText(row.tag,width*.5+4+row.data.x*this.scale,height*.5+10-row.data.y*this.scale,14);
		});
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