import React from "react";
import "./style/custom-node.css";

/**
 * Component that renders a person's name and gender, along with icons
 * representing if they have a driver license for bike and / or car.
 * @param {Object} props component props to render.
 */
function CustomNode({ token }) {
    let lp = 90 + 5*token.log_prob;
    let tokenStyle = {
        backgroundColor: "hsl(0deg 0% " + lp + "%)",
        border: "none",
    };
    if (token.eos) {
        tokenStyle.border="2px solid red";
    } else if (token.best_node) {
        tokenStyle.border="2px solid black";
    } 
    
    if (token.hl) {
        tokenStyle.border="2px solid blue";
    } 
    if (token.hlp) {
        tokenStyle.backgroundColor="green";
    }

    return (
        <div className={`flex-container token-node`} style={tokenStyle}>
            <div className="name">{token.token}</div>
            <div className="log-prob">{token.log_prob.toFixed(2)}</div>
        </div>
    );
}

export default CustomNode;