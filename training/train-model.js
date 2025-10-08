const { dockStart } = require('@nlpjs/basic');
const db = require('../src/database/mysql');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
    const dock = await dockStart({ use: ['Basic'] });
    const nlp = dock.get('nlp');
    nlp.addLanguage('pt');

    console.log('📚 Carregando intenções...');
    const intentsPath = path.join(__dirname, 'nlp-intents.json');
    const intentsData = JSON.parse(fs.readFileSync(intentsPath, 'utf-8'));

    let totalDocuments = 0;
    Object.entries(intentsData).forEach(([intent, phrases]) => {
        phrases.forEach(phrase => {
            nlp.addDocument('pt', phrase, intent);
            totalDocuments++;
        });
    });
    console.log(`✅ ${totalDocuments} documentos carregados`);

    console.log('📦 Buscando produtos...');
    try {
        const products = await db.getProducts();
        console.log(`✅ ${products.length} produtos encontrados`);

        products.forEach(product => {
            const title = product.fields.Title;
            const titleLower = title.toLowerCase();
            const words = titleLower.split(' ').filter(word => word.length > 2);

            const firstWord = words[0];
            const otherWords = words.slice(1);

            const variations = [
                titleLower,
                ...words,
                ...otherWords.map(word => `${firstWord} ${word}`),
                ...otherWords.map(word => `${word} ${firstWord}`)
            ];

            nlp.addNerRuleOptionTexts('pt', firstWord, titleLower, variations);
        });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error.message);
    }

    console.log('🔄 Treinando modelo...');
    await nlp.train();
    const modelPath = path.join(__dirname, '../models/model.private.nlp');
    nlp.save(modelPath);
    console.log('✅ Modelo treinado e salvo com sucesso');
})();
