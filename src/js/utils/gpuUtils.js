import { GPU } from 'gpu.js'
import { addGpuFunctions, createGpuKernels as krnl } from './gpuUtils-functs';

function makeKrnl(gpu, f, opts = {
  setDynamicOutput: true,
  setDynamicArguments: true,
  setPipeline: true,
  setImmutable: true
}) {
  const k = gpu.createKernel(f);

  if (opts.setDynamicOutput)    k.setDynamicOutput(true);
  if (opts.setDynamicArguments) k.setDynamicArguments(true);
  if (opts.setPipeline)         k.setPipeline(true)
  if (opts.setImmutable)        k.setImmutable(true);

  //.setOutput([signal.length]) //Call before running the kernel
  //.setLoopMaxIterations(signal.length);

  return k;
}

export class gpuUtils {
  
  constructor(gpu = new GPU()) {
    this.gpu = gpu;

    this.kernel;
    this.PI = 3.141592653589793;
    this.SQRT1_2 = 0.7071067811865476

    this.addFunctions();
  }

  addFunctions() { //Use kernel map instead? or this.kernel.addfunction? Test performance!
    addGpuFunctions.forEach(f => this.gpu.addFunction(f));

    this.correlograms = makeKrnl(this.gpu, krnl.correlogramsKern);
    this.correlogramsPC = makeKrnl(this.gpu, krnl.correlogramsKern);
    this.dft = makeKrnl(this.gpu, krnl.dftKern);
    this.idft = makeKrnl(this.gpu, krnl.idftKern);
    this.fft = makeKrnl(this.gpu, krnl.fftKern);
    this.ifft = makeKrnl(this.gpu, krnl.ifftKern);
    this.listdft2D = makeKrnl(this.gpu, krnl.listdft2DKern);
    this.listdft1D = makeKrnl(this.gpu, krnl.listdft1DKern);
    this.listdft1D_windowed = makeKrnl(this.gpu, krnl.listdft1D_windowedKern);
    this.bulkArrayMul = makeKrnl(this.gpu, krnl.bulkArrayMulKern);
  }

  gpuXCors(arrays, precompute=false, texOut = false) { //gpu implementation for bulk cross/auto correlations, outputs [[0:0],[0:1],...,[1:1],...[n:n]]
 
    var outputTex;
   
    if(precompute === true) {
      var means = [];
      var ests = [];
      arrays.forEach((arr,i) => {
        means.push(arr.reduce((prev,curr)=> curr += prev)/arr.length);
        ests.push(Math.sqrt(means[i].reduce((sum,item) => sum += Math.pow(item-mean1,2))));
      });

      var meansbuf = [];
      var estsbuf = [];
      var buffer = [];
      for(var i = 0; i < arrays.length; i++) {
        for(var j = i; j < arrays.length; j++){
          buffer.push(...arrays[i],...arrays[j]);
          meansbuf.push(means[i],means[j]);
          estsbuf.push(ests[i],ests[j]);
        }
      }
      this.correlogramsPC.setOutput([buffer.length]);
      this.correlogramsPC.setLoopMaxIterations(arrays[0].length*2);
      outputTex = this.correlogramsPC(buffer, arrays[0].length, meansbuf, estsbuf)
    }
    else{
      var buffer = [];
      for(var i = 0; i < arrays.length; i++) {
        for(var j = i; j < arrays.length; j++){
          buffer.push(...arrays[i],...arrays[j]);
        }
      }

      this.correlograms.setOutput([buffer.length]);
      this.correlograms.setLoopMaxIterations(arrays[0].length*2);

      outputTex = this.correlograms(buffer, arrays[0].length);
    }

    if(texOut === true) { return outputTex; }
    var outputbuf = outputTex.toArray();
    outputTex.delete();
    var outputarrs = [];

    for(var i = 0; i < arrays.length; i++){
      outputarrs.push(outputbuf.splice(0, arrays[0].length));
    }

    return outputarrs;

  } 

  //Input array buffer and the number of seconds of data
  gpuDFT(signalBuffer, nSeconds, scalar=1, texOut = false){

    var nSamples = signalBuffer.length;
    var sampleRate = nSamples/nSeconds;

    this.dft.setOutput([signalBuffer.length]);
    this.dft.setLoopMaxIterations(nSamples);

    var outputTex = this.dft(signalBuffer, nSamples, scalar);
    var output = null;
    if(texOut === false){
      var freqDist = this.makeFrequencyDistribution(nSamples, sampleRate);
      var signalBufferProcessed = outputTex.toArray();
      //console.log(signalBufferProcessed);
      outputTex.delete();
      return [freqDist,this.orderMagnitudes(signalBufferProcessed)]; //Returns x (frequencies) and y axis (magnitudes)
    }
    else {
      var tex = outputTex; 
      outputTex.delete(); 
      return tex;
    }
  }

  //Input array of array buffers of the same length and the number of seconds recorded
  MultiChannelDFT(signalBuffer, nSeconds, scalar=1, texOut = false) {
    
    var signalBufferProcessed = [];
      
    signalBuffer.forEach((row) => {
      signalBufferProcessed.push(...row);
    });
    //console.log(signalBufferProcessed);
  
    var nSamplesPerChannel = signalBuffer[0].length;
    var sampleRate = nSamplesPerChannel/nSeconds

    this.listdft1D.setOutput([signalBufferProcessed.length]); //Set output to length of list of signals
    this.listdft1D.setLoopMaxIterations(nSamplesPerChannel); //Set loop size to the length of one signal (assuming all are uniform length)
        
    var outputTex = this.listdft1D(signalBufferProcessed,nSamplesPerChannel, scalar);
    if(texOut === false){
      var orderedMagsList = [];

      var freqDist = this.makeFrequencyDistribution(nSamplesPerChannel, sampleRate);
      signalBufferProcessed = outputTex.toArray();
      //console.log(signalBufferProcessed);

      for(var i = 0; i < signalBufferProcessed.length; i+=nSamplesPerChannel){
        orderedMagsList.push(this.orderMagnitudes([...signalBufferProcessed.slice(i,i+nSamplesPerChannel)]));
      }
      //Now slice up the big buffer into individual arrays for each signal

      outputTex.delete();
      return [freqDist,orderedMagsList]; //Returns x (frequencies) and y axis (magnitudes)
    }
    else {
      var tex = outputTex; 
      outputTex.delete(); 
      return tex;
    }
  }

      
  //Input buffer of signals [[channel 0],[channel 1],...,[channel n]] with the same number of samples for each signal. Returns arrays of the positive DFT results in the given window.
  MultiChannelDFT_Bandpass(signalBuffer,nSeconds,freqStart,freqEnd,scalar=1, texOut = false) {

    var signalBufferProcessed = [];
      
    signalBuffer.forEach((row) => {
      signalBufferProcessed.push(...row);
    });
    //console.log(signalBufferProcessed);

    var freqEnd_nyquist = freqEnd*2;
    var nSamplesPerChannel = signalBuffer[0].length;
    var sampleRate = nSamplesPerChannel/nSeconds;
    
    this.listdft1D_windowed.setOutput([signalBufferProcessed.length]); //Set output to length of list of signals
    this.listdft1D_windowed.setLoopMaxIterations(nSamplesPerChannel); //Set loop size to the length of one signal (assuming all are uniform length)
        
    var outputTex = this.listdft1D_windowed(signalBufferProcessed,sampleRate,freqStart,freqEnd_nyquist, scalar);
    if(texOut === true) { return outputTex; }
    
    signalBufferProcessed = outputTex.toArray();
    outputTex.delete();

    //TODO: Optimize for SPEEEEEEED.. or just pass it str8 to a shader
    var freqDist = this.bandPassWindow(freqStart,freqEnd,sampleRate);
    return [freqDist, this.orderBPMagnitudes(signalBufferProcessed,nSeconds,sampleRate,nSamplesPerChannel)]; //Returns x (frequencies) and y axis (magnitudes)
  
  }

  orderMagnitudes(unorderedMags){
    return [...unorderedMags.slice(Math.ceil(unorderedMags.length*.5),unorderedMags.length),...unorderedMags.slice(0,Math.ceil(unorderedMags.length*.5))];  
  }

  makeFrequencyDistribution(FFTlength, sampleRate) {
    var N = FFTlength; // FFT size
    var df = sampleRate/N; // frequency resolution
    
    var freqDist = [];
    for(var i=(-N/2); i<(N/2); i++) {
      var freq = i*df;
      freqDist.push(freq);
    }
    return freqDist;
  }

  //Order and sum positive magnitudes from bandpass DFT
  orderBPMagnitudes(signalBufferProcessed,nSeconds,sampleRate,nSamplesPerChannel) {
    var posMagsList = [];
    for(var i = 0; i < signalBufferProcessed.length; i+=nSamplesPerChannel){
      posMagsList.push([...signalBufferProcessed.slice(i,Math.ceil(nSamplesPerChannel*.5+i))]);
     }

    var summedMags = [];
    var _sampleRate = 1/sampleRate;
    if(nSeconds > 1) { //Need to sum results when sample time > 1 sec
      posMagsList.forEach((row, k) => {
        summedMags.push([]);
        var _max = 1/Math.max(...row)
        for(var i = 0; i < row.length; i++ ){
          if(i == 0){
              summedMags[k]=row.slice(i,Math.floor(sampleRate));
              i = Math.floor(sampleRate);
          }
          else {
              var j = i-Math.floor(Math.floor(i*_sampleRate)*sampleRate)-1; //console.log(j);
              summedMags[k][j] = summedMags[k][j] * row[i-1]*_max;
          }
        }
        summedMags[k] = [...summedMags[k].slice(0,Math.ceil(summedMags[k].length*0.5))]
      });
      //console.log(summedMags);
      return summedMags;  
    }
    
    else {return posMagsList;}
  }

  //Returns the x axis (frequencies) for the bandpass filter amplitudes
  bandPassWindow(freqStart,freqEnd,sampleRate) {
 
    var freqEnd_nyquist = freqEnd*2;
    var fftwindow = [];
      for (var i = 0; i < Math.ceil(0.5*sampleRate); i++){
          fftwindow.push(freqStart + (freqEnd_nyquist-freqStart)*i/(sampleRate));
      }
    return fftwindow;
  }
}





var kernels = ({
  edgeDetection: [
    -1, -1, -1,
    -1,  8, -1,
    -1, -1, -1
  ],
  boxBlur: [
    1/9, 1/9, 1/9,
    1/9, 1/9, 1/9,
    1/9, 1/9, 1/9
  ],
  sobelLeft: [
    1,  0, -1,
    2,  0, -2,
    1,  0, -1
  ],
  sobelRight: [
    -1, 0, 1,
    -2, 0, 2,
    -1, 0, 1
  ],
  sobelTop: [
    1,  2,  1,
    0,  0,  0,
    -1, -2, -1  
  ],
  sobelBottom: [
    -1, 2, 1,
    0, 0, 0,
    1, 2, 1
  ],
  identity: [
    0, 0, 0, 
    0, 1, 0, 
    0, 0, 0
  ],
  gaussian3x3: [
    1,  2,  1, 
    2,  4,  2, 
    1,  2,  1
  ],
  guassian7x7: [
    0, 0,  0,   5,   0,   0,  0,
    0, 5,  18,  32,  18,  5,  0,
    0, 18, 64,  100, 64,  18, 0,
    5, 32, 100, 100, 100, 32, 5,
    0, 18, 64,  100, 64,  18, 0,
    0, 5,  18,  32,  18,  5,  0,
    0, 0,  0,   5,   0,   0,  0,
  ],
  emboss: [
    -2, -1,  0, 
    -1,  1,  1, 
    0,  1,  2
  ],
  sharpen: [
    0, -1,  0,
    -1,  5, -1,
    0, -1,  0
  ]
});


function includeGPUJS() {
  var link1 = document.createElement("script");
  link1.src = "https://raw.githubusercontent.com/gpujs/gpu.js/master/dist/gpu-browser.min.js"; // Can set this to be a nonlocal link like from cloudflare or a special script with a custom app
  link1.async = false; // Load synchronously
  link1.charset = "UTF-8";
  document.head.appendChild(link1); //Append script
}

function testGPUmath() {
  const gpu = new GPU();
  const multiplyMatrix = gpu.createKernel(function(a, b) {
    let sum = 0;
    for (let i = 0; i < 20; i++) {
      sum += this.thread.y * this.thread.x;//a[this.thread.y][i] * b[i][this.thread.x];
    }
    return sum;
  }).setOutput([20, 20]);

  var a = [], b = [];
  for(var i = 0; i < 20; i++){
    a.push([Math.floor(Math.random()*10),Math.floor(Math.random()*10)]);
    b.push([Math.floor(Math.random()*10),Math.floor(Math.random()*10)]);
  }

  var result = null;
  console.time('testGPUmath');
  result = multiplyMatrix(a, b);
  console.timeEnd('testGPUmath');
  console.info(result);
}

function testGPUrender() {
  const canvas = document.getElementById('c');
  const gpu = new GPU({
      canvas: canvas,
      mode: 'gpu'
  });
  
  const render = gpu.createKernel(function(time) {
      this.color(this.thread.x/(Math.abs(.5+Math.sin(time)*Math.cos(time))*500),this.thread.y/(1+Math.abs((.5+Math.sin(time)*Math.cos(time)))*500), 0.4, 1);
  })
  .setOutput([500, 500])
  .setGraphical(true);
  
  var tick = 0;
  var animate = () => {
      render(tick);
      tick+=0.01;
      setTimeout(requestAnimationFrame(animate),15);
  }

  //gpu.addNativeFunction('4DMean',
  //    `vec4`
  //);
  var result = null;
  console.time('square render');
  requestAnimationFrame(animate);
  console.timeEnd('square render');
}

function testGPUKernels() {
    var gpu = new GPU();
    const megaKernel = gpu.createKernelMap({
        addResult: function add(a, b) {
          return a + b + this.thread.x;
        },
        multiplyResult: function multiply(a, b) {
          return a * b;
        },
      }, function(a, b, c) {
        return multiply(add(a[this.thread.x], b[this.thread.x]), c[this.thread.x]);
      }, { output: [10] });
      
      console.info(megaKernel([...Array(10).fill(0)], [...Array(10).fill(10)], [...Array(10).fill(2)]));
}

function cov1D(arr1,arr2){ //Return covariance vector of two 1D vectors of length n
    var gpu = new GPU();
    function mean(arr,l){
        var sum = arr.reduce((prev,curr)=> curr += prev);
        return sum / l;
    }

    var cov = gpu.createKernel(function(arr1,arr1mean,arr2,arr2mean){
        var cov = (arr1[this.thread.x] - arr1mean) * (arr2[this.thread.x] - arr2mean);
        return cov;
    }).setOutput([arr1.length]);

    var cov1DKernel = gpu.combineKernels(cov, function(in1,in2,mean1,mean2){
        return cov(in1,mean1,in2,mean2);
    });

    var mean1 = mean(arr1,arr1.length);
    var mean2 = mean(arr2,arr2.length);

    //console.log(arr1);
    //console.info(mean(arr1,arr1.length));
    var result = null;
    console.time('cov1D');
    result = cov1DKernel(arr1,arr2,mean1,mean2);
    console.timeEnd('cov1D');
    console.info(result);
}

function sumP(arr) { //Parallel Sum Operation
    var gpu = new GPU();
    var sum = gpu.createKernelMap({
        //Break array up into blocks
        //Compute sum of each block
        //Pass partial sums to new blocks until sum is totaled.
        // e.g. input [1,2,3,4,5,6] => [1+2],[3+4],[5+6] = [3],[7],[11] => [3+7],[11] => [10],[11] => [10+11] => output [21]
            addResult: function add(a, b) {
              return a + b;
            },
            multiplyResult: function multiply(a, b) {
              return a * b;
            },
          }, function(a, b) {
            return add(a[this.thread.x], b[this.thread.x]);
          }, { output: [arr.length] });
    
    
    var result = null;
    console.time('sumP');
    result = sum(arr,arr);
    console.timeEnd('sumP');
    console.info(result);
    //console.info(sum());
}

function testGPUthreading3D(){
    var gpu = new GPU();
    var kernel = gpu.createKernel(function(){
        return [this.thread.x,this.thread.y,this.thread.z] //z increments first, then y, then x e.g. first outputs are [x0,y0,z0],[x0,y0,z1]...[x0,y0,zn] then [x0,y1,z0]... etc.
    }).setOutput([5,5,5]) // Outputs X*Y*Z Array(3)'s
    
    console.time('3D threading');
    var result = kernel();
    console.timeEnd('3D threading');
    console.info(result);
}

function testGPUthreading2D(){
    var gpu = new GPU();
    var kernel = gpu.createKernel(function(){
        return [this.thread.x,this.thread.y] //y increments first, then x. So [x0,y(1->n)] then [x1,y(1->n)] etc. outputted in that order
    }).setOutput([5,5]) // Outputs X*Y Array(3)'s
    console.time('2D threading');
    var result = kernel();
    console.timeEnd('2D threading');
    console.info(result);
}

function testVideoConv(video=null, kernel){
    const canvas = document.getElementById('v');
    var gpu = new GPU({
        canvas: canvas,
        mode: 'gpu'
    });

    if(video == null){
        var htmlToAppend = `<video src="https://upload.wikimedia.org/wikipedia/commons/e/ec/Jellyfish_in_Vr%C3%A5ngo.webm" id="vid" controls width="337" height="599" crossorigin="anonymous" loop autoplay muted></video>`;
        var div = document.createElement("div");
        div.innerHTML = htmlToAppend;
        document.body.appendChild(div);
        video = document.getElementById("vid");
        console.log(video.width,video.height);
    }
    var kernelRadius = (Math.sqrt(kernel.length) - 1) / 2;

    var convolution = gpu.createKernel(function (src, width, height, kernel, kernelRadius) {
        const kSize = 2 * kernelRadius + 1;
        let r = 0, g = 0, b = 0;
    
        let i = -kernelRadius;
        let imgOffset = 0, kernelOffset = 0;
        while (i <= kernelRadius) {
        if (this.thread.x + i < 0 || this.thread.x + i >= width) {
            i++;
            continue;
        }
    
        let j = -kernelRadius;
        while (j <= kernelRadius) {
            if (this.thread.y + j < 0 || this.thread.y + j >= height) {
            j++;
            continue;
            }
    
            kernelOffset = (j + kernelRadius) * kSize + i + kernelRadius;
            const weights = kernel[kernelOffset];
            const pixel = src[this.thread.y + i][this.thread.x + j];
            r += pixel.r * weights;
            g += pixel.g * weights;
            b += pixel.b * weights;
            j++;
        }
        i++;
        }
        this.color(r, g, b);
    })
        .setOutput([video.width, video.height])
        .setGraphical(true);

    video.addEventListener('loadeddata',()=>{
        var result = null;
        var render = () => {
            result = convolution(video, video.width, video.height, kernel, kernelRadius);
            requestAnimationFrame(render);
        }
        console.time('vid conv2D');
        render();
        console.timeEnd('vid conv2D');
        console.info(result);
    },false);
    

    return convolution.canvas;

}
//Next apply multiple kernels in same operation (untested)
function multiConv2D(img=null, kernels=[]){
    const multiConv2D = gpu.createKernelMap({
        conv2D: function (src, width, height, kernel, kernelRadius) {
            const kSize = 2 * kernelRadius + 1;
            let r = 0, g = 0, b = 0;
        
            let i = -kernelRadius;
            let imgOffset = 0, kernelOffset = 0;
            while (i <= kernelRadius) {
            if (this.thread.x + i < 0 || this.thread.x + i >= width) {
                i++;
                continue;
            }
        
            let j = -kernelRadius;
            while (j <= kernelRadius) {
                if (this.thread.y + j < 0 || this.thread.y + j >= height) {
                j++;
                continue;
                }
        
                kernelOffset = (j + kernelRadius) * kSize + i + kernelRadius;
                const weights = kernel[kernelOffset];
                const pixel = src[this.thread.y + i][this.thread.x + j];
                r += pixel.r * weights;
                g += pixel.g * weights;
                b += pixel.b * weights;
                j++;
            }
            i++;
            }
            this.color(r, g, b);
        }, function(img, width, height, kernels, kernelLengths, nKernels) {
            for(var i = 0; i < nKernels; i++){
                var kernelLength = kernelLengths[i];            
                var kernelRadius = (Math.sqrt(kernelLength) - 1) / 2;
                conv2D(img, width, height, kernels[i], kernelRadius);
            }
        }
    },{output:[img.width,img.height],graphical:true});
    
    //finally render the result. requestAnimationFrame for video or canvas
}

function testGPUpipeline() {
    var gpu = new GPU();
    const conv2D = gpu.createKernel(function(v, kernel) {
        return v[this.thread.x];
    })
      .setPipeline(true)
      .setOutput([img.width,img.height]);
    
    const kernel2 = gpu.createKernel(function(v, kernel) {
        return v[this.thread.x];
    })
      .setOutput([img.width,img.height]);

    var result = null;

    console.time('testGPUpipeline');
    kernels.forEach((kern)=>{
        conv2D(result, kern);
    });
    console.timeEnd('testGPUpipeline');
    console.info(result);
}

function testGPUCameraWobble() {
    var camera = true;
    var image = () => {
        if (camera) {
          const stream = navigator.mediaDevices
              ? navigator.mediaDevices.getUserMedia({video: true})
              : new Promise((y, n) => navigator.getUserMedia({video: true}, y, n));
          var html = document.createElement('div');
          html.innerHTML = `<video autoplay=true playsinline=true></video>`;
          const video =  document.body.appendChild(html);
          video.style.maxWidth = "100%";
          stream.then((stream) => {
            if ("srcObject" in video) video.srcObject = stream;
            else video.src = URL.createObjectURL(stream);
            invalidation.then(() => {
              stream.getTracks().forEach(t => t.stop());
              URL.revokeObjectURL(video.src);
            });    
            draw();
            return getimagedata(video);
          });
          //while (true) {
          //  requestAnimationFrame(getimagedata(video));
          //}
        } 
        else {
          return new Promise((resolve, reject) => {
            const image = new Image;
            image.onload = () => resolve(getimagedata(image));
            image.onerror = reject;
            image.crossOrigin = "anonymous";
            image.src = "https://raw.githubusercontent.com/tensorflow/tfjs-examples/master/mobilenet/cat.jpg";
          });
        }
      }
    
    function getimagedata(v) {
        const w = Math.min(400, v.width || Infinity), h = Math.min(300, v.height || Infinity);
        const context = DOM.context2d(w, h, 1);
        context.drawImage(v, 0, 0, w, h);
        return context.getImageData(0, 0, w, h);
      }

    var kernel = function(data, wobble) {
        var x = this.thread.x,
            y = this.thread.y;
      
        //var data = this.constants.data;
        // wouldn't be fun if the kernel did _nothing_
        x = Math.floor(x + wobble * Math.sin(y / 10));
        y = Math.floor(y + wobble * Math.cos(x / 10));
        
        var n = 4 * ( x + this.constants.w * (this.constants.h - y) );
        this.color(data[n]/256, data[n+1]/256,data[n+2]/256,1);
      }

    var render = new GPU({ mode: "gpu" })
            .createKernel(kernel)
            .setConstants({ w: image.width, h: image.height })
            .setOutput([image.width, image.height])
            .setGraphical(true);

    var draw = () => {
        //var fpsTime = performance.now(); var fps = 60;
        render(image.data, 14 * Math.sin(Date.now() / 400));
        render.getCanvas();
        //fps = (1 + fps) * (1 + 0.000984 * (fpsTime - (fpsTime = performance.now())));
        //console.log(fps);
        setTimeout(requestAnimationFrame(draw),15);
    }

    image();
}

var mandebrotFrag = 
`
uniform sampler1D tex;
uniform vec2 center;
uniform float scale;
uniform int iter;

void main() {
    vec2 z, c;

    c.x = 1.3333 * (gl_TexCoord[0].x - 0.5) * scale - center.x;
    c.y = (gl_TexCoord[0].y - 0.5) * scale - center.y;

    int i;
    z = c;
    for(i=0; i<iter; i++) {
        float x = (z.x * z.x - z.y * z.y) + c.x;
        float y = (z.y * z.x + z.x * z.y) + c.y;

        if((x * x + y * y) > 4.0) break;
        z.x = x;
        z.y = y;
    }

    gl_FragColor = texture1D(tex, (i == iter ? 0.0 : float(i)) / 100.0);
}
`;

var juliaSetFrag =
`
uniform sampler1D tex;
uniform vec2 c;
uniform int iter;

void main() {
    vec2 z;
    z.x = 3.0 * (gl_TexCoord[0].x - 0.5);
    z.y = 2.0 * (gl_TexCoord[0].y - 0.5);

    int i;
    for(i=0; i<iter; i++) {
        float x = (z.x * z.x - z.y * z.y) + c.x;
        float y = (z.y * z.x + z.x * z.y) + c.y;

        if((x * x + y * y) > 4.0) break;
        z.x = x;
        z.y = y;
    }

    gl_FragColor = texture1D(tex, (i == iter ? 0.0 : float(i)) / 100.0);
}
`;
