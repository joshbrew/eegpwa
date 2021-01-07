import {State} from '../frontend/State'
import {DOMFragment} from '../utils/DOMFragment'

//You can extend or call this class and set renderProps and these functions
export class Applet {
    constructor (parentNode="applets") { // customize the render props in your constructor
        this.parentNode = parentNode;
        this.AppletHTML = null;

        this.renderProps = {  //Add properties to set and auto-update the HTML
            width: "100px",
            height: "100px",
            id: String(Math.floor(Math.random()*1000000))
        }
    }

    //----------- default functions, keep and customize these --------

    HTMLtemplate(props=this.renderProps) {
        return ``;
    }

    setupHTML() {

    }

    init() {
        this.AppletHTML = new DOMFragment(this.HTMLtemplate,this.parentNode,this.renderProps,()=>{this.setupHTML()}); //Changes to this.props will automatically update the html template
    }

    deInit() {

    }

    onResize() {

    }

    //------------ additional functions here
}