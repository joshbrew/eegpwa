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
//Port over all original features
//Deal with data saving and local storage, state saving (use nodeFS or whatever its called)
//UI/Applet cleanup and flare
//Signal analysis cleanup
//UI switching (for HEG inclusion)
*/


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
                ATLAS.regenAtlases(State.data.freqStart,State.data.freqEnd,EEG.sps);
                UI.reInitApplets();
            }
        }
    });

    document.getElementById("runbutton").addEventListener('click',() => {
        if(State.data.connected === true) {
            State.setState({analyze: true, rawFeed: true});
            runEEGWorker();
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

    document.getElementById("setTags").addEventListener('click',() => {
        var setting = document.getElementById("GraphTime").value;
        if(setting < 1) {setting = 1;}
        State.setState({nSecAdcGraph: setting});
    });

    State.subscribe('connected', () => {
        if(State.data.connected === true) {document.getElementById("usbico").style.fill = "orange";}
        else { document.getElementById("usbico").style.fill = "black"; }
    });

}

const UI = new UIManager(initEEGui, deInitEEGui);



/* //Mouse target debug
document.addEventListener('click', function(e) {
    e = e || window.event;
    var target = e.target || e.srcElement,
        text = target.textContent || target.innerText;   
    console.log(target)
}, false);
*/









