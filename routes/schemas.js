const Joi = require('@hapi/joi')

const catalogSchema = Joi.object().keys({
    name: Joi.string(),
    quantity: Joi.number().integer().min(0)
})

module.exports = {catalogSchema}