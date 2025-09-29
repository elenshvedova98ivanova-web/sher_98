let reviews = [];

document.addEventListener('DOMContentLoaded', function() {
    loadReviews();
    
    document.getElementById('analyzeBtn').addEventListener('click', analyzeRandomReview);
});

function loadReviews() {
    fetch('reviews_test.tsv')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load TSV file: ${response.status}`);
            }
            return response.text();
        })
        .then(tsvData => {
            Papa.parse(tsvData, {
                header: true,
                delimiter: '\t',
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.errors.length > 0) {
                        showError('Error parsing TSV file: ' + results.errors[0].message);
                        return;
                    }
                    
                    reviews = results.data
                        .filter(row => row.text && row.text.trim() !== '')
                        .map(row => row.text.trim());
                    
                    if (reviews.length === 0) {
                        showError('No valid reviews found in the TSV file');
                    }
                },
                error: function(error) {
                    showError('Error parsing TSV file: ' + error.message);
                }
            });
        })
        .catch(error => {
            showError('Error loading reviews: ' + error.message);
        });
}

function analyzeRandomReview() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loading = document.getElementById('loading');
    const resultContainer = document.getElementById('resultContainer');
    const errorElement = document.getElementById('error');
    
    if (reviews.length === 0) {
        showError('No reviews loaded yet. Please wait...');
        return;
    }
    
    analyzeBtn.disabled = true;
    loading.style.display = 'block';
    resultContainer.style.display = 'none';
    errorElement.style.display = 'none';
    
    const randomReview = reviews[Math.floor(Math.random() * reviews.length)];
    document.getElementById('reviewText').textContent = `"${randomReview}"`;
    
    const apiToken = document.getElementById('apiToken').value.trim();
    
    getSentimentAnalysis(randomReview, apiToken)
        .then(sentiment => {
            displaySentimentResult(sentiment);
            resultContainer.style.display = 'block';
        })
        .catch(error => {
            showError('Analysis failed: ' + error.message);
        })
        .finally(() => {
            analyzeBtn.disabled = false;
            loading.style.display = 'none';
        });
}

function getSentimentAnalysis(text, apiToken) {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
    }
    
    return fetch('https://api-inference.huggingface.co/models/siebert/sentiment-roberta-large-english', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ inputs: text })
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 503) {
                throw new Error('Model is loading, please try again in a few seconds');
            } else if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later or use an API token');
            } else if (response.status === 401) {
                throw new Error('Invalid API token');
            } else {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }
        }
        return response.json();
    })
    .then(data => {
        if (!Array.isArray(data) || !data[0] || !Array.isArray(data[0])) {
            throw new Error('Unexpected API response format');
        }
        
        const result = data[0][0];
        
        if (!result || !result.label || typeof result.score !== 'number') {
            throw new Error('Invalid sentiment analysis result');
        }
        
        return {
            label: result.label,
            score: result.score
        };
    });
}

function displaySentimentResult(sentiment) {
    const sentimentIcon = document.getElementById('sentimentIcon');
    const sentimentLabel = document.getElementById('sentimentLabel');
    
    sentimentIcon.className = 'sentiment-icon';
    sentimentLabel.textContent = '';
    
    if (sentiment.label === 'POSITIVE' && sentiment.score > 0.5) {
        sentimentIcon.innerHTML = '<i class="fas fa-thumbs-up"></i>';
        sentimentIcon.classList.add('positive');
        sentimentLabel.textContent = `Positive (${(sentiment.score * 100).toFixed(1)}% confidence)`;
    } else if (sentiment.label === 'NEGATIVE' && sentiment.score > 0.5) {
        sentimentIcon.innerHTML = '<i class="fas fa-thumbs-down"></i>';
        sentimentIcon.classList.add('negative');
        sentimentLabel.textContent = `Negative (${(sentiment.score * 100).toFixed(1)}% confidence)`;
    } else {
        sentimentIcon.innerHTML = '<i class="fas fa-question-circle"></i>';
        sentimentIcon.classList.add('neutral');
        sentimentLabel.textContent = `Neutral/Uncertain (${(sentiment.score * 100).toFixed(1)}% confidence)`;
    }
}

function showError(message) {
    const errorElement = document.getElementById('error');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}
