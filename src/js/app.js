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

import {CSV} from './utils/general/csv'

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

//debugger;
//import fs from 'fs'
import * as BrowserFS from 'browserfs'
const fs = BrowserFS.BFSRequire('fs')
const BFSBuffer = BrowserFS.BFSRequire('buffer').Buffer;

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

    
    document.getElementById("useFilters").addEventListener('change',() => {
        State.data.useFilters = document.getElementById("useFilters").checked;
        if(State.data.useFilters === true) {
        }
    });
    document.getElementById("notch50").addEventListener('change',() => {
        State.data.notch50 = document.getElementById("notch50").checked;
    });
    document.getElementById("notch60").addEventListener('change',() => {
        State.data.notch60 = document.getElementById("notch60").checked;
    });
    document.getElementById("lp50").addEventListener('change',() => {
        State.data.lowpass50 = document.getElementById("lp50").checked;
    });
    document.getElementById("dcb").addEventListener('change',() => {
        State.data.dcblocker = document.getElementById("dcb").checked;
    });
    document.getElementById("sma4").addEventListener('change',() => {
        State.data.sma4 = document.getElementById("sma4").checked;
    });

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
      if(isNaN(freq0)) { freq0 = State.data.freqStart; } console.log(freq0)
      var freq1 = parseFloat(document.getElementById("freqEnd").value);
      if(isNaN(freq1)) { freq1 = State.data.freqEnd; }
      
        //State.data.freqStart = freq0; State.data.freqEnd = freq1;
        //updateBandPass(freq0,freq1);
        let start = null, end = null;
        ATLAS.fftMap.shared.bandPassWindow.forEach((freq,i) => {
            if(start === null && (freq0 >= freq || i === ATLAS.fftMap.shared.bandPassWindow.length-3)) start = i;
            if(end === null && (freq1 <= freq || i === ATLAS.fftMap.shared.bandPassWindow.length-1)) end = i+1;
        });
        State.data.fftViewStart = start;
        State.data.fftViewEnd = end;
        
        //console.log(start, end)
        
        if(State.data.analyze === false) UI.reInitApplets();
      
    });
    /*
    document.getElementById("setView").addEventListener('click',() => {
        var settings = document.getElementById("View").value;
        updateChannelView(settings);
        UI.reInitApplets();
    });
    */
    document.getElementById("setTags").addEventListener('click',() => {
        var settings = document.getElementById("Tags").value;
        updateChannelTags(settings);
        UI.reInitApplets();
    });

    //document.getElementById("setTimeSpan").addEventListener('click',() => {
    //    var setting = parseFloat(document.getElementById("GraphTime").value); 
    //    if(setting === NaN || setting < 1) {setting = 1;}
    //    State.setState({nSecAdcGraph: setting});
    //});

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
const initUI = (contents) => {
                            
    let settings = JSON.parse(contents);
    State.data.coherenceResult  = settings.coherenceResult;
    State.data.FFTResult        = settings.FFTResult;
    State.data.freqStart        = settings.freqStart;
    State.data.freqEnd          = settings.freqEnd;

    let configs = getConfigsFromHashes();
    if(configs.length === null){
        configs = settings.appletConfigs;
        State.data.appletConfigs = settings.appletConfigs;
    }
    console.log('browserfs successful')
    const UI = new UIManager(initEEGui, deInitEEGui, configs);
}

const initSystem = () => {
    let oldmfs = fs.getRootFS();

    BrowserFS.FileSystem.IndexedDB.Create({}, (e, rootForMfs) => {
        if(!rootForMfs) {
            let configs = getConfigsFromHashes();
            const UI = new UIManager(initEEGui, deInitEEGui, configs);
            throw new Error(`?`);
        }
        BrowserFS.initialize(rootForMfs);
        fs.exists('/data', (exists) => {
            if(exists) {

            }
            else {
                fs.mkdir('/data');
            }
            let contents = "";
            fs.readdir('/data', (e,data) => {
                if(e) console.error(e);
                
                fs.appendFile('/data/settings.json','',(e) => {
                    fs.readFile('/data/settings.json', (err, data) => {
                        if(err) {
                            fs.mkdir('/data');
                            fs.writeFile('/data/settings.json',
                            JSON.stringify(
                                {appletConfigs:State.data.appletConfigs,FFTResult:State.data.FFTResult,coherenceResult:State.data.coherenceResult,freqStart:State.data.freqStart,freqEnd:State.data.freqEnd,nSecAdcGraph:State.data.nSecAdcGraph})
                            , (err) => {
                                let configs = getConfigsFromHashes();
                                const UI = new UIManager(initEEGui, deInitEEGui, configs);
                                if(err) throw err;
                            });
                            
                        }

                        if(data.length === 0) {
                            let newcontent = JSON.stringify({appletConfigs:[],FFTResult:[],coherenceResult:[],freqStart:State.data.freqStart,freqEnd:State.data.freqEnd,nSecAdcGraph:State.data.nSecAdcGraph});
                            contents = newcontent;
                            fs.writeFile('/data/settings.json', newcontent, function(err){
                                if(err) throw err;
                                console.log("New settings file created");
                                initUI(contents);
                            });
                        }
                        else{ 
                            contents = data.toString();    
                            initUI(contents);
                        }
                    });
                });
                
            });
        });

        const newSession = () => {
            let sessionName = new Date().toISOString(); //Use the time stamp as the session name
            State.data.sessionName = sessionName;
            State.data.sessionChunks = 0;
            fs.appendFile('/data/'+sessionName,"", (e) => {
                if(e) throw e;
            });
        }

        const deleteSession = (path) => {
            fs.unlink(path, (e) => {
                if(e) console.error(e);
            });
        }

        const getFiles = () => {
            fs.readdir('/data', (e,data) => { 
                if(e) console.error(e);
                return data; //Returns an array of names in the directory
            });
        }

        const saveChunk = () => {
            let data = readyDataForWriting();
            State.data.sessionChunks++;
            if(State.data.sessionChunks === 1) {
                fs.appendFile('/data/'+State.data.sessionName, data[0]+data[1], (e) => {
                    if(e) throw e;
                }); //+"_c"+State.data.sessionChunks
            }
            else {
                fs.appendFile('/data/'+State.data.sessionName, data[1], (e) => {
                    if(e) throw e;
                }); //+"_c"+State.data.sessionChunks
            }
            let eeghead = Math.floor(EEG.sps*30); //Keep the most recent 30 seconds of data.
            let atlashead = Math.floor(30*State.data.workerMaxSpeed); //Estimated
            if(eeghead > EEG.data.counter || atleashead > ATLAS.coherenceMap.map[0].count)

            for(const prop in EEG.data) {
                if(typeof EEG.data[prop] === "object") {
                    EEG.data[prop].splice(0,head);
                }
                else if (prop === "counter") {
                    EEG.data[prop] -= head;
                }
            }
            ATLAS.channelTags.forEach((row, i) => {
                if(row.tag !== null && row.tag !== 'other'){
                    ATLAS.fftMap.map.find((o,i) => {
                        if(o.tag === row.tag){
                            if(o.data.count > atlashead) {
                                o.data.times.splice(0,atlashead);
                                o.data.amplitudes.splice(0,atlashead);
                                for(const prop in o.data.slices){
                                    o.data.slices[prop].splice(0,atlashead);
                                    o.data.means[prop].splice(0,atlashead);
                                }
                                o.data.count -= atlashead;
                            }
                            return true;
                        }
                    });
                }
            });
            ATLAS.coherenceMap.map.forEach((row,i) => {
                if(row.data.count > atlashead) {
                    row.data.times.splice(0,atlashead);
                    row.data.amplitudes.splice(0,atlashead);;
                    for(const prop in row.data.slices){
                        row.data.slices[prop].splice(0,atlashead);
                        row.data.means[prop].splice(0,atlashead);
                    }
                    row.data.count -= atlashead;
                }
                
            });
        }

        //Write CSV data in chunks to not overwhelm memory
        const writeToCSV = (path) => {
            fs.stat('/data'+path,(e,stats) => {
                if(e) throw e;
                let filesize = stats.size;
                fs.open('/data'+path,'r',(e,fd) => {
                    if(e) throw e;
                    let i = 0;
                    let maxFileSize = State.data.fileSizeLimitMb*1024*1024;
                    let end = maxFileSize;
                    if(filesize < maxFileSize) {
                        end = filesize;
                        let buf = new BFSBuffer.alloc(end);
                        fs.read(fd,buf,0,'utf-8',(e,bytesRead,output) => {   
                            if(bytesRead !== 0) CSV.saveCSV(output.toString(),path);
                        });
                    }
                    else {
                        const writeChunkToFile = () => {
                            if(i < filesize) {
                                if(i+end > filesize) {end=filesize - i;}  
                                let buf = new BFSBuffer.alloc(end);
                                let chunk = 0;
                                fs.read(fd,buf,i,'utf-8',(e,bytesRead,output) => {   
                                    if(bytesRead !== 0) {
                                        CSV.saveCSV(output.toString(),path+"_"+chunk);
                                        i+=maxFileSize;
                                        chunk++;
                                        writeChunkToFile();
                                    }
                                });
                            }
                        }  
                    }
                    //let file = fs.createWriteStream('./'+State.data.sessionName+'.csv');
                    //file.write(data.toString());
                }); 
            });
            
        }

        const saveSettings = () => {
            fs.writeFile('/data/settings.json',
            JSON.stringify({   
                    appletConfigs:State.data.appletConfigs,
                    FFTResult:State.data.FFTResult,
                    coherenceResult:State.data.coherenceResult,
                    freqStart:State.data.freqStart,
                    freqEnd:State.data.freqEnd
                })
            , (err) => {
                if(err) throw err;
            });
        }

        //TODO:
        /* 
        Figure out why larger buffers for streaming data cause a crash when full
        Automate the chunk saving for oncoming data as the buffers fill. Just have it call the save operation before the buffers fill completely so we don't lose any data
        Visual GUI for file browsing and saving.
        Test large datasets

        */






    });
}




initSystem();


//var configs = getConfigsFromHashes(); 
//console.log(configs)


//const UI = new UIManager(initEEGui, deInitEEGui, configs);



let wakeLock = null;

const requestWakeLock = async () => {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
            console.log("Wake Lock released!");
        });
        console.log("Keeping awake...");
    }
    catch (err) {
        console.error(err.name,err.message);
    }
}

const releaseWakeLock = async () => {
    if(!wakeLock) {
        return;
    }
    try {
        await wakeLock.release();
        wakeLock = null;
    }
    catch (err){
        console.error(err.name,err.message);
    }
}

window.addEventListener('focus', () => {
    requestWakeLock();
});

window.addEventListener('blur', () => {
    releaseWakeLock();
});