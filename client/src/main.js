//Get DOM elements
const searchForm = document.getElementById('search-form');
const keywordInput = document.getElementById('keyword-input');
const regionSelect = document.getElementById('region-select');
const resultsContainer = document.getElementById('results-container');
const loader = document.getElementById('loader');
const paginationContainer = document.getElementById('pagination-container');

//Object to keep track of the current search state
let currentSearchState = {
    keyword: '',
    region: '',
    page: 1
};

//Listen for form submission
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    currentSearchState.keyword = keywordInput.value.trim();
    currentSearchState.region = regionSelect.value;
    currentSearchState.page = 1;
    fetchProducts();
});

//Fetch products from the server
async function fetchProducts() {
    const { keyword, region, page } = currentSearchState;

    if (!keyword) {
        alert('Please enter a keyword.');
        return;
    }

    // Show loading indicator
    loader.classList.remove('hidden');
    resultsContainer.innerHTML = '';
    paginationContainer.classList.add('hidden');

    try {
        //Make the API call to fetch products
        //The proxy in vite config will redirect this to the server
        const response = await fetch(`/api/scrape?keyword=${encodeURIComponent(keyword)}&region=${region}&page=${page}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || 'Failed to fetch data from the server.');
        }

        // Parse the JSON response
        const data = await response.json();
        displayProducts(data.products);
        displayPagination(data.currentPage, data.totalPages);

    } catch (error) {
        console.error('Error:', error);
        resultsContainer.innerHTML = `<p style="color: red; text-align: center;">Error: ${error.message}</p>`;
    } finally {
        loader.classList.add('hidden');
    }
};

//Function to display the fetched products
function displayProducts(products) {
    if (!products || products.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center;">No products found. Try another keyword.</p>';
        return;
    }

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';

        // Map currency symbols to regions
        const currencyRegionMap = {
            US: '$',
            BR: 'R$',
            ES: '€'
        };

        // Format the product price and rating
        const productPrice = product.price ? `${currencyRegionMap[product.region]} ${product.price.toFixed(2)}` : 'Price not available';
        const productRating = product.ratingStars ? `⭐ ${product.ratingStars} / 5` : 'No rating';

        card.innerHTML = `
            <a href="${product.productUrl}" target="_blank" rel="noopener noreferrer">
                <div class="image-container">
                    <img src="${product.imageUrl}" alt="${product.title}" loading="lazy">
                </div>
                <div class="info">
                    <h3 class="title">${product.title}</h3>
                    <div>
                        <p class="price">${productPrice}</p>
                        <p class="rating">${productRating}</p>
                    </div>
                </div>
            </a>
        `;
        resultsContainer.appendChild(card);
    });
}

//Function to display pagination controls
function displayPagination(currentPage, totalPages) {
    paginationContainer.innerHTML = '';
    if (totalPages <= 1) {
        paginationContainer.classList.add('hidden');
        return;
    }

    paginationContainer.classList.remove('hidden');

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        currentSearchState.page--;
        fetchProducts();
    });

    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.disabled = currentPage >= totalPages;
    nextButton.addEventListener('click', () => {
        currentSearchState.page++;
        fetchProducts();
    });

    paginationContainer.append(prevButton, pageInfo, nextButton);
}