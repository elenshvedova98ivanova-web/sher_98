let reviews = [];
let currentReview = null;

document.addEventListener('DOMContentLoaded', function() {
    loadReviews();
    
    document.getElementById('random-review').addEventListener('click', selectRandomReview);
    document.getElementById('analyze-sentiment').addEventListener('click', analyzeSentiment);
    document.getElementById('count-nouns').addEventListener('click', countNouns);
});

async function loadReviews() {
    try {
        const response = await fetch('reviews_test.tsv');
        const tsvData = await response.text();
        
        Papa.parse(tsvData, {
            header: true,
            delimiter: '\t',
            complete: function(results) {
                reviews = results.data.filter(review => review.text && review.text.trim() !== '');
            },
            error: function(error) {
                showError('Failed to load reviews data: ' + error.message);
            }
        });
    } catch (error) {
        showError('Failed to fetch reviews file: ' + error.message);
    }
}

function selectRandomReview() {
    if (reviews.length === 0) {
        showError('No reviews available');
        return;
    }
    
    resetUI();
    currentReview = reviews[Math.floor(Math.random() * reviews.length)];
    document.getElementById('review-text').textContent = currentReview.text;
    document.getElementById('result-card').style.display = 'block';
}

async function analyzeSentiment() {
    if (!currentReview) {
        showError('Please select a review first');
        return;
    }
    
    const prompt = `Classify this review as positive, negative, or neutral: ${currentReview.text}`;
    await callApi(prompt, currentReview.text, 'sentiment');
}

async function countNouns() {
    if (!currentReview) {
        showError('Please select a review first');
        return;
    }
    
    const prompt = `Count the nouns in this review and return only High (>15), Medium (6-15), or Low (<6). ${currentReview.text}`;
    await callApi(prompt, currentReview.text, 'nouns');
}

async function callApi(prompt, text, analysisType) {
    const token = document.getElementById('token-input').value.trim();
    const spinner = document.getElementById('spinner');
    const errorDiv = document.getElementById('error');
    
    resetUI();
    spinner.style.display = 'block';
    disableButtons(true);
    
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch('https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                inputs: prompt
            })
        });
        
        if (response.status === 402) {
            throw new Error('Payment required - please check your API token');
        } else if (response.status === 429) {
            throw new Error('Rate limit exceeded - please try again later');
        } else if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const resultText = data[0]?.generated_text || '';
        const firstLine = resultText.split('\n')[0].toLowerCase().trim();
        
        if (analysisType === 'sentiment') {
            processSentimentResult(firstLine);
        } else if (analysisType === 'nouns') {
            processNounResult(firstLine);
        }
        
    } catch (error) {
        showError(error.message);
    } finally {
        spinner.style.display = 'none';
        disableButtons(false);
    }
}

function processSentimentResult(result) {
    let sentimentEmoji = '❓';
    
    if (result.includes('positive')) {
        sentimentEmoji = '👍';
    } else if (result.includes('negative')) {
        sentimentEmoji = '👎';
    } else if (result.includes('neutral')) {
        sentimentEmoji = '❓';
    }
    
    document.getElementById('sentiment-result').textContent = sentimentEmoji;
}

function processNounResult(result) {
    let nounEmoji = '🔴';
    
    if (result.includes('high')) {
        nounEmoji = '🟢';
    } else if (result.includes('medium')) {
        nounEmoji = '🟡';
    } else if (result.includes('low')) {
        nounEmoji = '🔴';
    }
    
    document.getElementById('noun-result').textContent = nounEmoji;
}

function disableButtons(disabled) {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.disabled = disabled;
    });
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function resetUI() {
    document.getElementById('error').style.display = 'none';
    document.getElementById('sentiment-result').textContent = '-';
    document.getElementById('noun-result').textContent = '-';
}
