import React from "react";
import { Graph } from "react-d3-graph";
import Table from 'react-bootstrap/Table';
import graphConfig from './graph_config.config';
import Header from "./Header";

import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import FloatingLabel from 'react-bootstrap/FloatingLabel';
import Spinner from 'react-bootstrap/Spinner';


// Format graph to fit window

// Recovers full sequence for a given node
// const recoverOutput = (node) => {
//     let out = "";
//     for (let i = 0; i < node.seq.length; i++) {
//         out += " " + graphData["nodes"][node.seq[i]].token;
//     }
//     return out;
// }

export default class Container extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            candidateSent: "Hover to see sentence...",
            customGraphConfig: Object.assign({}, graphConfig, {
                height: window.innerHeight / 2,
                width: window.innerWidth - 100,
            })
        };
    }

    onClickNode = (id, node) => {
        this.props.graphData['nodes'].forEach((candidate_node) => {
            candidate_node.hlp = false;
            for (let i = 0; i < node.seq.length; i++) {
                if (candidate_node.id === node.seq[i]) {
                    candidate_node.hlp = true;
                }
            }
        });
        this.props.updateGraphData(this.props.graphData);
    };

    onMouseOverNode = (id, node) => {
        this.props.graphData['nodes'].forEach((candidate_node) => {
            candidate_node.hl = false;
            for (let i = 0; i < node.seq.length; i++) {
                if (candidate_node.id === node.seq[i]) {
                    candidate_node.hl = true;
                }
            }
        });
        this.props.updateGraphData(this.props.graphData);
        this.setState({
            candidateSent: node.hyp
        });
    };

    onMouseOutNode = (id, node) => {
        this.props.graphData['nodes'].forEach((candidate_node) => {
            candidate_node.hl = false;
        });
        this.props.updateGraphData(this.props.graphData);
    };

    onClickLink = (source, target) => {
        console.log(`Clicked link between ${source} and ${target}`);
    };

    handleSubmit = (event) => {
        event.preventDefault();
        const complexSent = event.target.elements.complexSent.value;
        const decodingType = event.target.elements.decodingType.value;
        this.props.CallDecoder(complexSent, decodingType);
        this.setState({
            candidateSent: "Hover to see sentence..."
        });
    }

    render() {
        return (
            <div className='main-container'>
                <h1>Decoding Methods</h1>

                <Form className="input-form" onSubmit={this.handleSubmit}>
                    <Form.Group className="mb-3" controlId="formGenerate">
                        <Row>
                            <Col md={7}>
                                <FloatingLabel controlId="complexSent" label="Complex sentence">
                                    <Form.Control type="complex-sent" />
                                </FloatingLabel>
                            </Col>
                            <Col md={3}>
                                <FloatingLabel
                                    controlId="decodingType"
                                    label="Decoding type"
                                >
                                    <Form.Select>
                                        <option value="beam">Beam Search</option>
                                        <option value="sampling">Top-p Sampling</option>
                                    </Form.Select>
                                </FloatingLabel>
                            </Col>
                            <Col md={2} className="submit-button-container">
                                {this.props.isLoading ? (
                                    <Button variant="primary" disabled>
                                        <Spinner
                                            as="span" animation="border" size="sm"
                                            role="status" aria-hidden="true"
                                        />
                                        <span className="button-disabled"> Loading</span>
                                    </Button>
                                ) : (
                                    <Button variant="primary" type="submit">
                                        Generate
                                    </Button>
                                )}
                            </Col>
                        </Row>
                    </Form.Group>
                </Form>

                <Header
                    candidateSent={this.state.candidateSent}
                />

                <div className="graph-container">
                    <Graph
                        id="graph-id"
                        data={this.props.graphData}
                        config={this.state.customGraphConfig}
                        onClickNode={this.onClickNode}
                        onClickLink={this.onClickLink}
                        onMouseOverNode={this.onMouseOverNode}
                        onMouseOutNode={this.onMouseOutNode}
                    />
                </div>

                <div className='candidate-outputs'>
                    <h2>Candidate Outputs</h2>
                    <Table striped bordered hover>
                        <thead>
                            <tr>
                                <th>LogP</th>
                                <th>sBLEU</th>
                                <th>BS</th>
                                <th>Output</th>
                            </tr>
                        </thead>
                        <tbody>
                            {this.props.candidateOutputs.map((output, i) => {
                                return (
                                    <tr key={output[3]}>
                                        <td>{output[0].toFixed(2)}</td>
                                        <td>{output[1].toFixed(2)}</td>
                                        <td>{output[4].toFixed(2)}</td>
                                        <td className="output-sent">{output[2]}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </Table>
                </div>
            </div>
        );
    }

    updateDimensions = () => {
        this.setState({
            customGraphConfig: Object.assign({}, graphConfig, {
                height: window.innerHeight / 2,
                width: window.innerWidth - 100,
            })
        });
    };
    componentDidMount() {
        window.addEventListener('resize', this.updateDimensions);
    }
    componentWillUnmount() {
        window.removeEventListener('resize', this.updateDimensions);
    }
}