import {State} from '../frontend/State'
import { EEG, ATLAS, addChannelOptions, addCoherenceOptions } from '../frontend/EEGInterface';
import {eegBarChart} from '../utils/eegvisuals'
import {DOMFragment} from '../utils/DOMFragment'

//You can extend or call this class and set renderProps and these functions
export class BarChartApplet {
    constructor (parentNode=document.getElementById("applets")) { // customize the render props in your constructor
        this.parentNode = parentNode;
        this.AppletHTML = null;

        this.renderProps = {  //Add properties to set and auto-update the HTML
            width: "100px",
            height: "100px",
            id: String(Math.floor(Math.random()*1000000))
        }

        this.class = null;
        this.mode = "bars";
        this.sub = null;
    }

    //----------- default functions, keep and customize these --------

    //Create HTML template string with dynamic properties set in this.renderProps. Updates to these props will cause updates to the template
    HTMLtemplate(props=this.renderProps) {
        return ``;
    }

    //Setup javascript functions for the new HTML here
    setupHTML() {

    }

    //Initialize the applet. Keep the first line.
    init() {
        this.AppletHTML = new DOMFragment(this.HTMLtemplate,this.parentNode,this.renderProps,()=>{this.setupHTML()},undefined,"NEVER"); //Changes to this.props will automatically update the html template
    }

    //Destroy applet. Keep this one line
    deInit() {
        this.AppletHTML.deleteNode();
    }

    //Callback for when the window resizes. This gets called by the UIManager class to help resize canvases etc.
    onResize() {

    }

    //------------ add new functions below ---------------

    onUpdate = () => {
        if(this.mode === "bars") {
            var ch = parseInt(document.getElementById(this.renderProps.id+"channel").value);
            var tag = null;
            ATLAS.channelTags.find((o,i) => {
                if(o.ch === ch){
                tag = o.tag;
                return true;
                }
            });
            if(tag !== null){
                var coord = ATLAS.getAtlasCoordByTag(tag);
                this.class.latestData = coord.data.amplitudes[coord.data.amplitudes.length-1];
            }
        }
        else if (this.mode === "mirroredbars") {
            var ch1 = parseInt(document.getElementById(this.renderProps.id+"channel").value);
            var tag1 = null;
            ATLAS.channelTags.find((o,i) => {
                if(o.ch === ch1){
                tag1 = o.tag;
                return true;
                }
            });

            var ch2 = parseInt(document.getElementById(this.renderProps.id+"channel").value);
            var tag2 = null;
            ATLAS.channelTags.find((o,i) => {
                if(o.ch === ch2){
                tag2 = o.tag;
                return true;
                }
            });
            var coord1, coord2;
            if(tag1 !== null){
                coord1 = ATLAS.getAtlasCoordByTag(tag1);
                if(tag2 !== null){
                coord2 = ATLAS.getAtlasCoordByTag(tag2);
                this.class.updateCharts(coord1.data.slices[coord1.data.slices.length-1],coord2.data.slices[coord2.data.slices.length-1]);
                }
            }
        }

}