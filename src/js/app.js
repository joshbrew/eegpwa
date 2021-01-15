import {State} from './frontend/State'
import {UIManager} from './frontend/UIManager'
import {DOMFragment} from './frontend/DOMFragment'
import {
    menu_template,
    menuheader_template,
    menudropdown_template,
    menudropdown2_template,
    menudropdown3_template,
    appletbox_template,
    menu_setup
} from './frontend/UITemplates'
import {
  EEG, ATLAS,
  EEGInterfaceSetup,
  runEEGWorker, 
  readyDataForWriting,
  updateBandPass, 
  updateChannelTags, 
  updateChannelView,
} from './frontend/EEGInterface'

//Import applets!
import {AppletExample} from './applets/AppletExample'
import {SmoothieApplet} from './applets/SmoothieApplet'
import {uPlotApplet} from './applets/uPlotApplet'
import {SpectrogramApplet} from './applets/SpectrogramApplet'
import {BrainMapApplet} from './applets/BrainMapApplet'
import {BarChartApplet} from './applets/BarChartApplet'
import {MirrorBarsApplet} from './applets/MirrorBarsApplet'
import {TimeChartsApplet} from './applets/TimeChartsApplet'

//Add applets here that you want accessible (Follow Applet.js format!!!)
State.data.appletClasses.push(
  { name:"uPlot Applet",         cls: uPlotApplet        },
  { name:"SmoothieJS Applet",    cls: SmoothieApplet     },
  { name:"BrainMap Applet",      cls: BrainMapApplet     },
  { name:"Spectrogram Applet",   cls: SpectrogramApplet  },
  { name:"BarChart Applet",      cls: BarChartApplet     },
  { name:"MirrorBars Applet",    cls: MirrorBarsApplet   },
  { name:"TimeCharts Applet",    cls: TimeChartsApplet   }
);

//TODO: find a better place for this


/*
//TODO: 
//Automatic bandpass applied to ADC stream (fix combine kernels)
//Control y-axis window in uplot
//Overlaid ADC graphs with y-axes adjusted (just subtract from math.min)
//Channel 9 button visual
//Moving average for coherence.

//Preconfigurations with links to preconfigure -- just need to make settings
//More visualization of settings i.e. channel tag assignments and which channels are being computed
//Slow cortical signal features.
//Deal with data saving and local storage, state saving (use nodeFS or whatever its called)
//UI/Applet cleanup and flare
//Signal analysis cleanup
//UI switching (for HEG inclusion)
*/


//import fs from 'fs'
import * as BrowserFS from 'browserfs'
const fs = BrowserFS.BFSRequire('fs')

function getConfigsFromHashes() {
    let hashes = window.location.hash;
    if(hashes === "") { return [] }
    let hasharr = hashes.split('#');
    hashes.shift();

    var appletConfigs = [];
    hasharr.forEach((hash,i) => {
        var cfg = JSON.parse(hash); // expects cfg object on end of url like #{name:"",idx:n,settings:["a","b","c"]}#{...}#...
        appletConfigs.push(cfg);
    });
    return appletConfigs;    
}


//UI Code

function deInitEEGui() {
    State.data.applets.forEach((applet,i) => {
        applet.classinstance.deInit();
    })
    State.data.menunode.deleteNode()
    State.data.appletbox.deleteNode();
}

//Allows creating and destroying
function initEEGui() {

    EEGInterfaceSetup();

    State.data.menunode = new DOMFragment(menu_template,document.body);
    State.data.menuheader = new DOMFragment(menuheader_template,"menu_header");
    State.data.menudropdown = new DOMFragment(menudropdown_template,"menu_dropdown");
    State.data.menudropdown2 = new DOMFragment(menudropdown2_template,"menu_dropdown2");
    State.data.menudropdown3 = new DOMFragment(menudropdown3_template,"menu_dropdown3");
    State.data.appletbox = new DOMFragment(appletbox_template, document.body);
    menu_setup();

    document.getElementById("connectbutton").addEventListener('click',() => {
        //console.log(State.data.connected);
        if(State.data.connected === true) {EEG.closePort();} 
        else{  
            EEG.setupSerialAsync(); 
            if(ATLAS.fftMap.map[0].data.count > 0) {
                ATLAS.regenAtlasses(State.data.freqStart,State.data.freqEnd,EEG.sps);
                UI.reInitApplets();
            }
        }
    });

    document.getElementById("runbutton").addEventListener('click',() => {
        if(State.data.connected === true) {
            if(EEG.data.counter < 512){
                setTimeout(()=> {
                    State.setState({analyze: true, rawFeed: true});
                    setTimeout(runEEGWorker,100);
                },1000);
            }
            else{
                State.setState({analyze: true, rawFeed: true});
                setTimeout(runEEGWorker,100);
            }
        }
        else{
            EEG.setupSerialAsync();
        }
    });

    document.getElementById("stopbutton").addEventListener('click',() => {
        State.setState({analyze: false, rawFeed: false});
    });

    document.getElementById("setBandpass").addEventListener('click',() => {
      var freq0 = parseFloat(document.getElementById("freqStart").value);
      var freq1 = parseFloat(document.getElementById("freqEnd").value);
      if(typeof freq0 === 'number' && typeof freq1 === 'number'){
        State.data.freqStart = freq0; State.data.freqEnd = freq1;
        updateBandPass(freq0,freq1);
      }
    });

    document.getElementById("setView").addEventListener('click',() => {
        var settings = document.getElementById("View").value;
        updateChannelView(settings);
        UI.reInitApplets();
    });

    document.getElementById("setTags").addEventListener('click',() => {
        var settings = document.getElementById("Tags").value;
        updateChannelTags(settings);
        UI.reInitApplets();
    });

    document.getElementById("setTimeSpan").addEventListener('click',() => {
        var setting = parseFloat(document.getElementById("GraphTime").value); 
        if(setting === NaN || setting < 1) {setting = 1;}
        State.setState({nSecAdcGraph: setting});
    });

    State.subscribe('connected', () => {
        if(State.data.connected === true) {document.getElementById("usbico").style.fill = "orange";}
        else { document.getElementById("usbico").style.fill = "black"; }
    });

}



/* //Mouse target debug
document.addEventListener('click', function(e) {
    e = e || window.event;
    var target = e.target || e.srcElement,
        text = target.textContent || target.innerText;   
    console.log(target)
}, false);
*/


const initSystem = () => {
    BrowserFS.configure({
        fs: "MountableFileSystem",
        options: {
        '/data': { fs: "IndexedDB", options:{ storeName:'data'} }
        //'/zip': { fs: "ZipFS"}
        //'/tmp': { fs: "InMemory" },
        //'/mnt/usb0': { fs: "LocalStorage" }
        //'/cpp': { fs: "Emscripten" } // External C++ and Python scripts via https://developers.google.com/web/updates/2019/01/emscripten-npm. 
        //'/py': { fs: "" } // See: https://github.com/iodide-project/pyodide -- 
        }
    }, (e) => {
        BrowserFS.initialize()
    });

    fs.open('/data/settings.json', 'w+', (e,f) => { 
        if(e) throw e; 
     
        //var buffer = new ArrayBuffer(100000);
        var contents = "";
        fs.read('/data/settings.json', (err,data) => {
            if(err) throw err;
            contents = data.toString();
        });
        if(contents.length < 1) {
            let newcontent = JSON.stringify({appletConfigs:[],FFTResult:[],coherenceResult:[],freqStart:0,freqEnd:100,nSecAdcGraph:10});
            contents = newcontent;
            fs.write(f, newcontent, function(err){
                if(err) throw err;
                console.log("Settings file created");
            });
        }
        
        fs.close(f);

        let settings = JSON.parse(contents);
        State.data.coherenceResult  = settings.coherenceResult;
        State.data.FFTResult        = settings.FFTResult;
        State.data.freqStart        = settings.freqStart;
        State.data.freqEnd          = settings.freqEnd;
        State.data.nSecAdcGraph     = settings.nSecAdcGraph;

        var configs = getConfigsFromHashes();
        if(configs.length === null){
            configs = settings.appletConfigs;
            State.data.appletConfigs = settings.appletConfigs;
        }

        const UI = new UIManager(initEEGui, deInitEEGui, configs);

    });
  

    const onMaxData = () => {
        if(State.data.counter >= EEG.maxBufferedSamples) {
            let content = readyDataForWriting();
            let path = "/data/"+State.data.sessionName;
            if(State.data.sessionName === ""){
                State.data.sessionName = new Date().toISOString();
                fs.appendFile(path,content[0].join(","));
            }
            content[1].splice(content[1].length-EEG.sps*State.data.nSecAdcGraph,EEG.sps*State.data.nSecAdcGraph);// Shave off the last 10 seconds since we'll be kep
            fs.appendFile(path,content[1].join(","));

            
            for(prop in EEG.data){
                if(typeof EEG.data[prop] === 'object'){
                    EEG.data[prop].splice(0,EEG.data.counter-EEG.sps*State.data.nSecAdcGraph);
                    EEG.data[prop].concat(new Array(EEG.data.counter-EEG.sps*State.data.nSecAdcGraph).fill(0));
                    EEG.data.counter = EEG.sps*State.data.nSecAdcGraph;
                }
            }
            //TODO: Leave some data in the atlasses or just have applets work with their own circular buffers
            ATLAS.regenAtlasses(State.data.freqStart, State.data.freqEnd, EEG.sps);
            //Clears heap to save memory
        }
    }

    //State.subscribe('counter',onMaxData);

}




//initSystem();


var configs = getConfigsFromHashes(); 
console.log(configs)


const UI = new UIManager(initEEGui, deInitEEGui, configs);
