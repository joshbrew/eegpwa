import {ObjectListener} from './ObjectListener'

export class DOMFragment {
    constructor(templateStringGen=this.templateStringGen,parentNode={}, props={}, onRender=()=>{}, onchange=()=>{}) {
        this.templateStringGen = templateStringGen(props);
        this.onRender = onRender;
        
        this.parentNode = parentNode;
        if(typeof parentNode === "string") {
            this.parentNode = document.getElementById(parentNode);
        }
        this.renderSettings = {
            templateStringGen: templateStringGen,
            onchange: onchange,
            props: props
        }
        this.templateString = templateStringGen(props);
        this.props = props; //Soft copy of a properties object the node may rely on
        this.node = null;

        this.listener = new ObjectListener();

        this.listener.addListener('templateChange',this.renderSettings,'templateStringGen',() => {
            this.updateNode();
        });

        if(this.props!=={}){
            this.listener.addListener('props',this.renderSettings,'props',() => {
                console.log("update")
                this.updateNode();
                this.renderSettings.onchange();
            });
        }

        this.renderNode();

    }

    onRender = () => {}

    //appendId is the element Id you want to append this fragment to
    appendFragment(HTMLtoAppend, parentNode) {
        var template = document.createElement('template');
        template.innerHTML = HTMLtoAppend;
        var fragment = template.content;
        parentNode.appendChild(fragment);
        return parentNode.children[parentNode.children.length-1];
    }
  
    //delete selected fragment. Will delete the most recent fragment if Ids are shared.
    deleteFragment(parentNode,nodeId) {
        var node = document.getElementById(nodeId);
        parentNode.removeChild(node);
    }
  
    //Remove Element Parent By Element Id (for those pesky anonymous child fragment containers)
    removeParent(elementId) {
        // Removes an element from the document
        var element = document.getElementById(elementId);
        element.parentNode.parentNode.removeChild(element.parentNode);
    }

    renderNode(parentNode=this.parentNode){
        this.node = this.appendFragment(this.templateString,parentNode);
        this.onRender();
    }

    updateNode(parentNode=this.parentNode, node=this.node, props=this.props){
        parentNode.removeChild(node);
        this.templateString = this.renderSettings.templateStringGen(this.props);
        this.renderNode(parentNode, props);
    }

    deleteNode(node=this.node) {
        if(typeof node === "string"){
            thisNode = document.getElementById(node);
            thisNode.parentNode.removeChild(thisNode);
            this.node = null;
        }
        else if(typeof node === "object"){
            node.parentNode.removeChild(thisNode);
            this.node = null;
        }
    }
}
