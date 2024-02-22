const toPositiveInt = (value) => {
    if (!isNaN(parseInt(value)) && isFinite(value)) {
        let n = Number(value)
        if (Number.isInteger(n) && n >= 0) return n
        return NaN
    }
    return NaN
}

module.exports = {toPositiveInt}