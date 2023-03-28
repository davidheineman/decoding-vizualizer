import React, { setState } from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import Container from './Container';

import initalData from './beam_output.json';

function processData(data) {
  // Calculate the total beams and sequence length
  let total_beams = data["nodes"].reduce((acc, beam) => {
    if (beam.step === 0) { acc++; } return acc;
  }, 0);

  let seq_length = data["nodes"].reduce((acc, beam) => {
    if (beam.step > acc) { acc = beam.step; } return acc;
  }, 0);

  // Loads data into graph format
  let newGraphData = {
    "nodes": data["nodes"].map((beam, i) => {
      return {
        id: i,
        token: beam.token,
        log_prob: beam.log_prob,
        x: beam.step * 1.5 * 32 + 32,
        y: (i % total_beams) * 1.5 * 32 + 32,
        step: beam.step,
        best_node: false,
        hl: false,
        hlp: false,
        eos: beam.eos,
        eos_idx: null,
        seq: beam.seq,
        sbleu: beam.sbleu,
        hyp: beam.hyp,
        bertscore: beam.bertscore
      }
    }),
    "links": data["links"]
  };

  // Gets all terminating outputs
  let candidateOutputs = []
  for (let i = 0; i < newGraphData["nodes"].length; i++) {
    newGraphData["nodes"][i].eos_idx = i;
    let currNode = newGraphData["nodes"][i];
    if (currNode.eos) {
      candidateOutputs.push([currNode.log_prob, currNode.sbleu, currNode.hyp, currNode.eos_idx, currNode.bertscore]);
    }
  }

  candidateOutputs = candidateOutputs.sort(function (a, b) { return b[0] - a[0]; });

  // Gets the highest probability nodes at each step
  for (let beam = 0; beam < seq_length; beam++) {
    let best = { log_prob: -Infinity, best_node: false };
    let best_idx = 0;

    for (let node of newGraphData["nodes"]) {
      if (node.step === beam && node.log_prob > best.log_prob) { best = node; best_idx = node.id; }
    }

    newGraphData["nodes"].forEach(node => { if (node.id === best_idx) { node.best_node = true; } });
  }

  return [newGraphData, candidateOutputs];
}

var [initData, initCands] = processData(initalData);

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      graphData: initData,
      candidateOutputs: initCands,
      isLoading: false
    };
  }

  updateGraphData = (data) => {
    let [newData, newCands] = processData(data);
    this.graphData = newData;
    this.candidateOutputs = newCands;
    this.setState({ 
      graphData: newData, 
      candidateOutputs: newCands,
      isLoading: false
    });
  };

  setData = (data) => {
    this.graphData = data;
  };

  CallDecoder = (complex_sent, type, num_beams = 10, temperature = 0.9) => {
    this.setState({ isLoading: true });
    fetch(`/decode?input_text=${complex_sent}&type=${type}&num_beams=${num_beams}&temperature=${temperature}`, {
      method: "GET",
      // headers: headers,   
    }).then((res) =>
      res.json().then((data) => {
        this.updateGraphData(data);
      })
    );
  }

  render() {
    return (
      <div className="App">
        <Container
          updateGraphData={this.setData}
          CallDecoder={this.CallDecoder}
          graphData={this.state.graphData}
          candidateOutputs={this.state.candidateOutputs}
          isLoading={this.state.isLoading}
        />
      </div>
    );
  }
}

export default App;
