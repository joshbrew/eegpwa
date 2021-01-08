import {State} from './frontend/State'
import {UIManager} from './frontend/UIManager'
import {DOMFragment} from './utils/DOMFragment'
import {
    menu_template,
    menuheader_template,
    menudropdown_template,
    appletbox_template,
    menu_setup
} from './frontend/UITemplates'
import {
  EEG, ATLAS,
  EEGInterfaceSetup, 
  updateBandPass, 
  updateChannelTags, 
  updateChannelView
} from './frontend/EEGInterface'

//Import applets!
import {AppletExample} from './applets/AppletExample'
import {SmoothieApplet} from './applets/SmoothieApplet'
import {uPlotApplet} from './applets/uPlotApplet'

//Add applets here that you want accessible (Follow Applet.js format!!!)
State.data.appletClasses.push(
  uPlotApplet,
  SmoothieApplet
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
        applet.deInit();
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
    State.data.appletbox = new DOMFragment(appletbox_template, document.body);
    menu_setup();

    document.getElementById("connectbutton").onclick = () => {
        EEG.setupSerialAsync();
    }

    document.getElementById("runbutton").onclick = () => {
        if(State.data.connected === true) {
            State.setState({analyze: true, rawFeed: true});
            runEEGWorker();
        }
        else{
            EEG.setupSerialAsync();
        }
    }

    document.getElementById("stopbutton").onclick = () => {
        State.setState({analyze: false, rawFeed: false});
    }

    document.getElementById("setBandpass").onclick = () => {
      var freq0 = parseFloat(document.getElementById("freqStart").value);
      var freq1 = parseFloat(document.getElementById("freqEnd").value);
      if(typeof freq0 === 'number' && typeof freq1 === 'number'){
        State.data.freqStart = freq0; State.data.freqEnd = freq1;
        updateBandPass(freq0,freq1);
      }
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









