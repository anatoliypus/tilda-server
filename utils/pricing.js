const yuanRub = 13.9;
const shippingRub = 1600;
const chinaWorkPercent = 5;
const fee = {
    under2000: 1500,
    more2000: 2000,
    more3000Percent: 10,
    more10000Percent: 13,
};

const calculatePrice = (priceYuan) => {
    // цены приходят с двумя нолями сзади
    priceYuan = priceYuan / 100
    if (priceYuan < 2000) {
        // до 2000 юаней не включительно
        return Math.ceil(
            priceYuan * yuanRub +
            ((priceYuan * yuanRub) / 100) * chinaWorkPercent +
            shippingRub +
            fee.under2000
        );
    } else if (priceYuan >= 2000 && priceYuan < 3000) {
        // 2000 - 2999 юаней
        return Math.ceil(
            priceYuan * yuanRub +
            ((priceYuan * yuanRub) / 100) * chinaWorkPercent +
            shippingRub +
            fee.more2000
        );
    } else if (priceYuan >= 3000 && priceYuan < 10000) {
        // 3000 - 9999 юаней
        const withoutComissionAndShipping =
            priceYuan * yuanRub + ((priceYuan * yuanRub) / 100) * chinaWorkPercent;
        return Math.ceil(
            withoutComissionAndShipping +
            shippingRub +
            (withoutComissionAndShipping / 100) * fee.more3000Percent
        );
    } else {
        // больше 10 000 юаней
        const withoutComissionAndShipping =
            priceYuan * yuanRub + ((priceYuan * yuanRub) / 100) * chinaWorkPercent;
        return Math.ceil(
            withoutComissionAndShipping +
            shippingRub +
            (withoutComissionAndShipping / 100) * fee.more10000Percent
        );
    }
};

module.exports = { calculatePrice };
