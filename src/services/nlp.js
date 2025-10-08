const { dockStart } = require('@nlpjs/basic');
const fs = require('fs');
const config = require('../config/env');

let nlpInstance = null;

const initializeNLP = async () => {
    if (nlpInstance) return nlpInstance;

    const dock = await dockStart({
        settings: {
            nlp: {
                autoSave: false,
                languages: [config.nlp.language],
                forceNER: true,
            },
        },
        use: ['Basic', 'BuiltinMicrosoft'],
    });

    const builtin = dock.get('builtin-microsoft');
    const ner = dock.get('ner');
    ner.container.register('extract-builtin-??', builtin, true);
    const nlp = dock.get('nlp');

    if (fs.existsSync(config.nlp.modelPath)) {
        nlp.load(config.nlp.modelPath);
    } else {
        throw new Error('Modelo NLP não encontrado');
    }

    nlpInstance = nlp;
    return nlp;
};

const processMessage = async (message) => {
    const nlp = await initializeNLP();
    const result = await nlp.process(message);
    return result;
};

module.exports = {
    initializeNLP,
    processMessage
};
