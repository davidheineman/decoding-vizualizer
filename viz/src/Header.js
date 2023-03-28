import React from 'react';
import "./Header.css";

export default class Header extends React.Component {
    render() {
        return (
            <div className="header">
                <div className="candidate-sent">{this.props.candidateSent}</div>
            </div>
        );
    }
}