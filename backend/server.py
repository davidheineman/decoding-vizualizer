import sys
# sys.path.append('../transformers/src/')
sys.path.append('C:/Users/heine/Documents/research/decoding-algos/transformers/src/')

import torch
from transformers import T5Tokenizer, MT5Model, MT5ForConditionalGeneration
# from transformers import T5Tokenizer, T5ForConditionalGeneration
from flask import Flask, render_template, request

# Scoring libraries
from nltk.translate.bleu_score import sentence_bleu as bleu
import bert_score as bs

# Debugging
import os
import inspect

torch.set_grad_enabled(False)

print("Loading model... ", end='')
config = MT5Model.config_class.from_pretrained("google/mt5-base")
tokenizer = T5Tokenizer.from_pretrained("../models/mT5-english")
# tokenizer = T5Tokenizer.from_pretrained("C:/Users/heine/Documents/research/decoding-algos/models/mT5-english")
model = MT5ForConditionalGeneration.from_pretrained(
    "../models/mT5-english", 
    # "C:/Users/heine/Documents/research/decoding-algos/models/mT5-english", 
    device_map="auto", config=config
).eval()

MAX_LEN = 64
EOS_TOKEN = float(tokenizer.encode(".")[1])
# EOS_TOKEN = tokenizer.eos_token_id

# tokenizer = T5Tokenizer.from_pretrained("google/flan-t5-large")
# model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-large", device_map="auto").eval()
print("Done!")

app = Flask(__name__)

# Route for seeing a data
@app.route('/decode')
def decode():
    # DO NOT USE THIS IN PRODUCTION, THIS IS INCREDIBLY DANGEROUS
    input_text = str(request.args.get('input_text'))

    print(f"Recieved input: {input_text}")

    # Prompt for FLAN T5
    # input_text = "simplify the following sentence: [INPUT]".replace('[INPUT]', input_text)
    
    # Control tokens
    input_text = f'<NbChars_0.3> <LevSim_0.4> <WordRank_0.5> <DepTreeDepth_0.5> {input_text}'

    print(f"Processing input: '{input_text}' with decoding function: {os.path.abspath(inspect.getfile(model.generate))}")

    # Parse input args
    decoding_algo = request.args.get('type')
    if decoding_algo == "beam":
        nbeams = int(request.args.get('num_beams'))
        output = beam_search(input_text, nbeams)
    elif decoding_algo == "sampling":
        temperature = float(request.args.get('temperature'))
        output = sampling(input_text, temperature)
    else:
        return "Invalid decoding algorithm"
    
    print("Finished processing")

    return output

def beam_search(input_text, nbeams=10):
    input_ids = tokenizer(input_text, return_tensors="pt").input_ids.to("cuda")
    outputs = model.generate(
        input_ids, 
        max_length=MAX_LEN,

        # Beam Search
        num_beams=nbeams,
        num_beam_groups=1,

        output_scores=True,
        return_dict_in_generate=True
    )

    nodes, links = [], []
    prev_beams = None
    i = 0    

    for beam_num, beam_scores in enumerate(outputs.beam_indices):
        curr_beams = []

        conncect_beams = any([beam != 0 for beam in beam_scores[2]])
        
        for token_num, token in enumerate(beam_scores[1]):
            node = {
                "id": i,
                "token": tokenizer.decode(torch.Tensor([token]).cuda()),
                "token_num": token,
                "log_prob": float(beam_scores[0][token_num]),
                "step": beam_num,
                "eos": bool(token == EOS_TOKEN),
                "seq": [i],
            }

            if conncect_beams:
                node["seq"] = nodes[prev_beams[beam_scores[2][token_num]]]["seq"] + node["seq"]
                link = {
                    "source": prev_beams[beam_scores[2][token_num]],
                    "target": i,
                }
                links += [link]

            hyp = [nodes[seq_id]["token_num"] for seq_id in node["seq"] if seq_id != i] + [node["token_num"]]
            hyp = tokenizer.decode(torch.Tensor(hyp).cuda())
            node["hyp"] = hyp
            node["sbleu"] = -1
            node["bertscore"] = -1
            if node["eos"]:
                node["sbleu"] = bleu([tokenizer.tokenize(input_text)], tokenizer.tokenize(hyp))

            nodes += [node]
            curr_beams += [i]
            i += 1
            
        prev_beams = curr_beams

    # Delete tensor tokens
    for n in nodes:
        del n["token_num"]

    # nodes = add_bertscore(nodes)

    root = {
        "links": links,
        "nodes": nodes
    }

    return root

def sampling(input_text, temperature=0.9):
    input_ids = tokenizer(input_text, return_tensors="pt").input_ids.to("cuda")
    
    outputs = model.generate(
        input_ids, 
        max_length=MAX_LEN,

        # Nucleus Sampling
        do_sample=True, 
        temperature=temperature,

        output_scores=True,
        return_dict_in_generate=True
    )

    nodes, links = [], []
    prev_beams = None
    i = 0

    out_seq = outputs['sequences'].flatten()[1:]

    for beam_num in range(len(outputs.scores)):
        logp, tokens = torch.topk(outputs.scores[beam_num], 10)
        tokens, logp = tokens.flatten(), logp.flatten()
        
        for token_num, token in enumerate(tokens):
            node = {
                "id": i,
                "token": tokenizer.decode(token),
                "token_num": int(token),
                "log_prob": float(logp[token_num]),
                "step": beam_num,
                # Not quite accurate, indicates whether the token is '.'
                "eos": bool(token == EOS_TOKEN),
                "seq": [i],
            }

            if beam_num != 0:
                node["seq"] = prev_beams["seq"] + node["seq"]
                link = {
                    "source": prev_beams['id'],
                    "target": i,
                }
                links += [link]

            hyp = [nodes[seq_id]["token_num"] for seq_id in node["seq"] if seq_id != i] + [node["token_num"]]
            hyp = tokenizer.decode(torch.Tensor(hyp).cuda())
            node["hyp"] = hyp
            node["sbleu"] = -1
            node["bertscore"] = -1
            if node["eos"]:
                node["sbleu"] = bleu([tokenizer.tokenize(input_text)], tokenizer.tokenize(hyp))

            nodes += [node]
            i += 1
            
        prev_beams = [n for n in nodes if n["step"] == beam_num and n["token_num"] == out_seq[beam_num]]
        assert len(prev_beams) == 1
        prev_beams = prev_beams[0]

    # Delete tensor tokens
    for n in nodes:
        del n["token_num"]

    # nodes = add_bertscore(nodes)

    root = {
        "links": links,
        "nodes": nodes
    }

    return root

def add_bertscore(nodes):
    # Add BERTScore
    candidates = [n for n in nodes if n['eos']]
    hypotheses = [n['hyp'] for n in candidates]
    references = [[h for j, h in enumerate(hypotheses) if i != j] for i, c in enumerate(candidates)]

    if len(candidates) == 0:
        return nodes

    bertscores = bs.score(hypotheses, references, lang='en')
    for i, cand in enumerate(candidates):
        cand['bertscore'] = avg([float(j[i]) for j in bertscores])

    return nodes
        
# Running app
if __name__ == '__main__':
    app.run(debug=True)