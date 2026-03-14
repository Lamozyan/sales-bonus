/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // @TODO: Расчет выручки от операции
   const { discount, quantity, sale_price } = purchase;
   return sale_price * quantity * (1 - discount / 100);
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // @TODO: Расчет бонуса от позиции в рейтинге
    const { profit } = seller;
    if (index === 0) {
     return profit * 0.15;
    } else if (index === 1 || index === 2) {
     return profit * 0.1;
    } else if (index === total - 1) {
     return 0;
    } else {
     return profit * 0.05;
  }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // Проверка входных данных
    if (
        !data ||
        !Array.isArray(data.sellers) ||
        !Array.isArray(data.products) ||
        !Array.isArray(data.purchase_records)
    ) {
        throw new Error("Некорректные входные данные!");
    }
    
    if (
        data.sellers.length === 0 ||
        data.products.length === 0 ||
        data.purchase_records.length === 0
    ) {
        throw new Error("Переданные коллекции пустые!");
    }

    // Проверка наличия опций
    if (
        !options ||
        typeof options.calculateRevenue !== "function" ||
        typeof options.calculateBonus !== "function"
    ) {
        throw new Error("Опции должны содержать функции calculateRevenue и calculateBonus!");
    }

    const toKopecks = (rubles) => Math.floor(rubles * 100);
    const fromKopecks = (kopecks) => kopecks / 100;

    // Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map((seller) => ({
        seller_id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {},
    }));

    // Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = Object.fromEntries(
        sellerStats.map((seller) => [seller.seller_id, seller])
    );
    
    const productIndex = Object.fromEntries(
        data.products.map((product) => [product.sku, {product, purchase_price_kopecks: toKopecks(product.purchase_price)}])
    );

    // Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach((record) => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;
        
        seller.sales_count += 1;
        
        // Расчет revenue через перебор items
        let recordRevenue = 0;
        
        record.items.forEach((item) => {
            const product = productIndex[item.sku];
            if (!product) return;

            const revenueRub = options.calculateRevenue(item, product);
            const revenueKopecks = toKopecks(revenueRub);
            const costKopecks = product.purchase_price_kopecks * item.quantity;
            const profitKopecks = revenueKopecks - costKopecks;
            
            seller.revenue += revenueKopecks;
            seller.profit += profitKopecks;

            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // Сортировка продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);

    // Назначение премий на основе ранжирования
    sellerStats.forEach((seller, index) => {
        const sellerForBonus = {seller, profit: fromKopecks(seller.profit)};
        const bonusRub = options.calculateBonus(index, sellerStats.length, sellerForBonus);
        seller.bonus = toKopecks(bonusRub);
        
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({
                sku,
                quantity,
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    // Подготовка итоговой коллекции с нужными полями
    return sellerStats.map((seller) => ({
        seller_id: seller.seller_id,
        name: seller.name,
        revenue: fromKopecks(seller.revenue),
        profit: fromKopecks(seller.profit),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: fromKopecks(seller.bonus),
    }));
}
