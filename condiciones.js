module.exports = [
    {
        type: 'sequence',
        length: 10,
        condition: 'valor > 2',
        alertMessage: 'Condition met: last 10 numbers > 2'
    },
    {
        type: 'sequence',
        length: 3,
        condition: 'valor > 2 && valor < 1.5',
        alertMessage: 'Condition met: last 3 numbers > 2 && < 1.5'
    },
    // Add more conditions here
];

const evaluarCondicion = (valor, condicion) => {
    try {
        return eval(condicion.replace(/valor/g, valor));
    } catch (e) {
        console.error('Error evaluando la condición:', e);
        return false;
    }
};

module.exports.evaluarCondicion = evaluarCondicion;