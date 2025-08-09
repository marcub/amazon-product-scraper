class ScrapeController {

    constructor() {
        //Binds "this" context of scrapeData method to the current instance.
        this.scrapeData = this.scrapeData.bind(this);
    }

    // Parses a price string (e.g., "$1,234.56" or "R$ 1.234,56") and converts it to a float.
    parsePriceToFloat(priceString) {
        if (!priceString || typeof priceString !== 'string') {
            return null;
        }

        const lastDotIndex = priceString.lastIndexOf('.');
        const lastCommaIndex = priceString.lastIndexOf(',');

        let cleanedString;

        //Check which model is being used, European/Brazil or US
        if (lastCommaIndex > lastDotIndex) {
            cleanedString = priceString.replace(/\./g, '').replace(',', '.');
        } else {
            cleanedString = priceString.replace(/,/g, '');
        }

        //Use regex to remove all non-numeric characters except for the decimal point
        const finalString = cleanedString.replace(/[^\d.]/g, '');
        
        const price = parseFloat(finalString);

        return isNaN(price) ? null : price;
    }

    //Extracts the numeric value from a rating string (e.g., "4.5 out of 5 stars")
    parseRatingToFloat(ratingString) {
        if (!ratingString || typeof ratingString !== 'string') {
            return null;
        }

        const standardizedString = ratingString.replace(',', '.');
        //Use regex to extract the first number
        const match = standardizedString.match(/(\d+\.\d+)|(\d+)/);

        if (match && match[0]) {
            return parseFloat(match[0]);
        }

        return null;
    }

    //Main method for scraping data
    async scrapeData(req, res) {

        try {
            const keyword = req.query.keyword;
            const region = req.query.region || "US";
            const page = req.query.page || 1;

            if (!keyword) {
                return res.status(400).json({ error: "Keyword is required" });
            }

            const { JSDOM } = require("jsdom");
            const axios = require("axios");

            //Map Amazon regions to their respective domains
            const amazonDomains = {
                US: "https://www.amazon.com",
                ES: "https://www.amazon.es",
                BR: "https://www.amazon.com.br"
            };

            //Encode the keyword to be URL-safe
            const encodedKeyword = encodeURIComponent(keyword);
            const url = `${amazonDomains[region]}/s?k=${encodedKeyword}&page=${page}`;

            //Define HTTP headers to simulate a real user
            //This is crucial to avoid being blocked by Amazon
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Referer': 'https://www.google.com/'
            };

            //Perform the GET request using axios and create a DOM from the response using JSDOM, allowing to query the HTML
            const response = await axios.get(url, { headers });
            const dom = new JSDOM(response.data);
            const document = dom.window.document;

            // Select all 'div' elements that represent a product.
            const productElements = document.querySelectorAll('div[data-component-type="s-search-result"]');

            //Map the product elements to an array of product objects
            const products = Array.from(productElements).map(product => {
                const titleElement = product.querySelector('div[data-cy="title-recipe"] a h2 span');
                const linkElement = product.querySelector('div[data-cy="title-recipe"] .a-link-normal');
                const rantingElement = product.querySelector('div[data-cy="reviews-block"] .a-icon-alt');
                const priceElement = product.querySelector('div[data-cy="price-recipe"] .a-price .a-offscreen');
                const imageElement = product.querySelector('div[data-cy="image-container"] .s-image');

                const title = titleElement ? titleElement.textContent.trim() : null;
                const productUrl = linkElement ? `${amazonDomains[region]}${linkElement.getAttribute('href')}` : null;
                const ratingStars = rantingElement ? this.parseRatingToFloat(rantingElement.textContent.trim()) : null;
                const price = priceElement ? this.parsePriceToFloat(priceElement.textContent.trim()) : null;
                const imageUrl = imageElement ? imageElement.src : null;

                return { title, price, ratingStars, imageUrl, productUrl, region };
            }).filter(p => p.title && p.price); // Filter the results to remove items that are not products (no title or price).


            //Logic to extract pagination information
            const paginationContainer = document.querySelector('.s-pagination-strip');
            let totalPages = 1;
            let currentPage = parseInt(page, 10);

            if (paginationContainer) {
                // Get the last visible page element
                const lastPageElement = paginationContainer.querySelector('.s-pagination-item.s-pagination-disabled:not(.s-pagination-previous):not(.s-pagination-ellipsis)');
                if (lastPageElement && lastPageElement.textContent.trim() !== '...') {
                    totalPages = parseInt(lastPageElement.textContent.trim(), 10);
                } else {
                    totalPages = currentPage;
                }

                const nextButtonDisabled = paginationContainer.querySelector('.s-pagination-item.s-pagination-next.s-pagination-disabled');
                // If the "Next" button is disabled, it means we are on the last page.
                if (nextButtonDisabled) {
                    totalPages = currentPage;
                }
            }

            res.json({ products, currentPage, totalPages });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: "An error occurred while scraping data.", details: error.message });
        }
    }
}

module.exports = new ScrapeController();