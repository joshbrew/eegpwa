import {State} from '../frontend/State'
import {DOMFragment} from '../utils/DOMFragment'

//You can extend or call this class and set renderProps and these functions
export class Applet {
    constructor (parentNode=document.getElementById("applets")) { // customize the render props in your constructor
        this.parentNode = parentNode;
        this.AppletHTML = null;

        this.renderProps = {  //Add properties to set and auto-update the HTML
            width: "100px",
            height: "100px",
            id: String(Math.floor(Math.random()*1000000))
        }
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
        this.AppletHTML = new DOMFragment(this.HTMLtemplate,this.parentNode,this.renderProps,()=>{this.setupHTML()}); //Changes to this.props will automatically update the html template
    }

    //Destroy applet. Keep this one line
    deInit() {
        this.AppletHTML.deleteNode();
    }

    //Callback for when the window resizes. This gets called by the UIManager class to help resize canvases etc.
    onResize() {

    }

    //------------ add new functions below ---------------

    //doSomething() {}

}