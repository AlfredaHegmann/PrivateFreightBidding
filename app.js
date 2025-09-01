const CONTRACT_ADDRESS = "0x2E7B5f277595e3F1eeB9548ef654E178537cb90E";
const CONTRACT_ABI = [
    "function owner() external view returns (address)",
    "function jobCounter() external view returns (uint256)",
    "function verifyCarrier(address _carrier) external",
    "function verifyShipper(address _shipper) external",
    "function postJob(string memory _origin, string memory _destination, string memory _cargoType) external returns (uint256)",
    "function submitBid(uint256 _jobId, uint32 _price) external",
    "function closeBidding(uint256 _jobId) external",
    "function revealBid(uint256 _jobId, uint32 _price) external",
    "function awardJob(uint256 _jobId, address _carrier) external",
    "function getJobInfo(uint256 _jobId) external view returns (string memory origin, string memory destination, uint8 status)",
    "function getBidInfo(uint256 _jobId, address _carrier) external view returns (bool hasSubmitted, bool isRevealed, uint32 revealedPrice)",
    "function getBidders(uint256 _jobId) external view returns (address[])",
    "function freightJobs(uint256) external view returns (string memory origin, string memory destination, string memory cargoType, uint256 weight, uint256 volume, uint256 deadline, uint256 biddingEndTime, address shipper, uint8 status, uint256 finalPrice, bool isPrivate)",
    "function verifiedCarriers(address) external view returns (bool)",
    "function verifiedShippers(address) external view returns (bool)",
    "event JobPosted(uint256 indexed jobId, address indexed shipper)",
    "event BidSubmitted(uint256 indexed jobId, address indexed carrier)",
    "event BidRevealed(uint256 indexed jobId, address indexed carrier, uint32 price)",
    "event JobAwarded(uint256 indexed jobId, address indexed carrier, uint256 finalPrice)"
];

let provider;
let signer;
let contract;
let fhevmInstance;
let userAddress;
let currentRole = '';
let selectedJobId = 0;

// Random color generation functions
function getRandomColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

function getRandomTailwindColor() {
    const colors = [
        'red', 'green', 'purple', 'indigo', 'pink', 'teal',
        'orange', 'yellow', 'cyan', 'lime', 'emerald', 'violet'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

function applyRandomColors() {
    const randomColor = getRandomTailwindColor();
    const color1 = getRandomColor();
    const color2 = getRandomColor();

    // Update gradient background
    const gradientBg = document.querySelector('.gradient-bg');
    if (gradientBg) {
        gradientBg.style.background = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
    }

    // Apply random background colors to elements
    const elementsToColor = document.querySelectorAll('.random-color-bg');
    elementsToColor.forEach(el => {
        const color = getRandomColor();
        el.style.backgroundColor = color;
    });

    // Apply random text colors
    const textElements = document.querySelectorAll('.random-color-text');
    textElements.forEach(el => {
        const color = getRandomColor();
        el.style.color = color;
    });

    // Add animation class to some elements
    const animatedElements = document.querySelectorAll('.fas');
    animatedElements.forEach((el, index) => {
        if (index % 3 === 0) {
            el.classList.add('color-animation');
            setTimeout(() => el.classList.remove('color-animation'), 3000);
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up event listeners');
    setupEventListeners();
});

// Initialize other components when window loads
window.addEventListener('load', async () => {
    console.log('Window loaded, initializing app');
    await initializeFHEVM();
    applyRandomColors();
    loadStats();

    // Ensure event listeners are set up again in case DOM wasn't ready before
    setupEventListeners();

    // Change colors every 5 seconds
    setInterval(applyRandomColors, 5000);
});

async function initializeFHEVM() {
    try {
        if (typeof fhevm !== 'undefined') {
            fhevmInstance = await fhevm.createInstance({
                chainId: 8009,
                networkUrl: "https://devnet.zama.ai/",
                gatewayUrl: "https://gateway.devnet.zama.ai/"
            });
            console.log("FHE instance initialized");
        }
    } catch (error) {
        console.error("Failed to initialize FHE:", error);
    }
}

function setupEventListeners() {
    try {
        const connectBtn = document.getElementById('connectWallet');
        const postJobBtn = document.getElementById('postJobBtn');
        const refreshJobsBtn = document.getElementById('refreshJobsBtn');
        const submitBidBtn = document.getElementById('submitBidBtn');

        if (connectBtn) {
            connectBtn.addEventListener('click', connectWallet);
            console.log('Connect wallet event listener added');
        } else {
            console.error('Connect wallet button not found');
        }

        if (postJobBtn) {
            postJobBtn.addEventListener('click', postJob);
        }

        if (refreshJobsBtn) {
            refreshJobsBtn.addEventListener('click', loadAvailableJobs);
        }

        if (submitBidBtn) {
            submitBidBtn.addEventListener('click', submitBid);
        }
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

async function connectWallet() {
    console.log('Connect wallet function called');

    if (typeof window.ethereum !== 'undefined') {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            userAddress = await signer.getAddress();

            if (CONTRACT_ADDRESS === "YOUR_DEPLOYED_CONTRACT_ADDRESS") {
                showNotification('Please update CONTRACT_ADDRESS with your deployed contract address', 'warning');
                document.getElementById('connectWallet').style.display = 'none';
                document.getElementById('accountInfo').style.display = 'block';
                document.getElementById('accountInfo').textContent = `Connected: ${userAddress.substring(0, 6)}...${userAddress.substring(38)} (Contract Not Deployed)`;
                return;
            }

            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

            try {
                const owner = await contract.owner();
                document.getElementById('connectWallet').style.display = 'none';
                document.getElementById('accountInfo').style.display = 'block';
                document.getElementById('accountInfo').textContent = `Connected: ${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;

                // Show and populate contract information
                document.getElementById('contractInfo').classList.remove('hidden');
                document.getElementById('contractAddress').textContent = CONTRACT_ADDRESS;
                document.getElementById('contractOwner').textContent = owner;
                document.getElementById('yourAddress').textContent = userAddress;

                // Check verification status
                await updateVerificationStatus();

                // Show owner panel if user is the owner
                if (userAddress.toLowerCase() === owner.toLowerCase()) {
                    document.getElementById('ownerPanel').classList.remove('hidden');
                    showNotification('Welcome, Contract Owner!', 'success');
                }

                // Hide deployment notice when contract is connected
                const deploymentNotice = document.getElementById('deploymentNotice');
                if (deploymentNotice) {
                    deploymentNotice.style.display = 'none';
                }

                showNotification('Wallet connected successfully!', 'success');
                setupContractEvents();
            } catch (contractError) {
                console.error('Contract connection failed:', contractError);
                showNotification('Contract not found at the specified address. Please deploy the contract first.', 'error');
                document.getElementById('connectWallet').style.display = 'none';
                document.getElementById('accountInfo').style.display = 'block';
                document.getElementById('accountInfo').textContent = `Connected: ${userAddress.substring(0, 6)}...${userAddress.substring(38)} (Contract Not Found)`;
            }

        } catch (error) {
            console.error('Wallet connection failed:', error);
            showNotification('Failed to connect wallet', 'error');
        }
    } else {
        showNotification('Please install MetaMask wallet', 'error');
    }
}

function setupContractEvents() {
    contract.on('JobPosted', (jobId, shipper) => {
        if (shipper.toLowerCase() === userAddress.toLowerCase()) {
            showNotification(`Job #${jobId} posted successfully!`, 'success');
            loadMyJobs();
        }
        loadStats();
        loadAvailableJobs();
    });

    contract.on('BidSubmitted', (jobId, carrier) => {
        if (carrier.toLowerCase() === userAddress.toLowerCase()) {
            showNotification(`Bid submitted successfully!`, 'success');
            loadMyBids();
        }
        loadStats();
    });

    contract.on('BidRevealed', (jobId, carrier, price) => {
        showNotification(`Bid revealed: ${price} USD`, 'info');
    });

    contract.on('JobAwarded', (jobId, carrier, finalPrice) => {
        showNotification(`Job #${jobId} awarded to carrier`, 'success');
        loadMyJobs();
        loadMyBids();
    });
}

async function updateVerificationStatus() {
    if (!contract || !userAddress) return;

    try {
        const isShipper = await contract.verifiedShippers(userAddress);
        const isCarrier = await contract.verifiedCarriers(userAddress);

        let status = 'Not Verified';
        if (isShipper && isCarrier) {
            status = '✅ Verified as Shipper & Carrier';
        } else if (isShipper) {
            status = '✅ Verified as Shipper';
        } else if (isCarrier) {
            status = '✅ Verified as Carrier';
        } else {
            status = '❌ Not Verified';
        }

        document.getElementById('verificationStatus').textContent = status;
    } catch (error) {
        console.error('Error checking verification status:', error);
        document.getElementById('verificationStatus').textContent = 'Error checking status';
    }
}

function selectRole(role) {
    currentRole = role;
    document.getElementById('shipperPanel').classList.toggle('hidden', role !== 'shipper');
    document.getElementById('carrierPanel').classList.toggle('hidden', role !== 'carrier');

    if (role === 'shipper') {
        checkVerification('shipper');
        loadMyJobs();
    } else if (role === 'carrier') {
        checkVerification('carrier');
        loadAvailableJobs();
        loadMyBids();
    }

    showNotification(`Selected ${role === 'shipper' ? 'Shipper' : 'Carrier'} mode`, 'info');
}

async function checkVerification(role) {
    if (!contract || !userAddress) return;

    try {
        let isVerified;
        const owner = await contract.owner();

        if (role === 'shipper') {
            isVerified = await contract.verifiedShippers(userAddress);
        } else {
            isVerified = await contract.verifiedCarriers(userAddress);
        }

        console.log(`User: ${userAddress}`);
        console.log(`Contract Owner: ${owner}`);
        console.log(`Is verified ${role}: ${isVerified}`);

        if (!isVerified) {
            document.getElementById('verifyModal').classList.remove('hidden');
            setupVerificationButtons();

            // Update modal with owner information
            const modalContent = document.querySelector('#verifyModal .text-gray-600');
            modalContent.innerHTML = `
                You need to be verified by the contract owner to use this platform.<br><br>
                <strong>Contract Owner:</strong> ${owner}<br><br>
                Please contact the contract owner to verify your address: <code>${userAddress}</code>
            `;
        } else {
            showNotification(`You are verified as a ${role}!`, 'success');
        }
    } catch (error) {
        console.error('Error checking verification:', error);
        if (error.code === 'BAD_DATA') {
            showNotification('Contract not properly deployed. Please check the contract address.', 'error');
        } else {
            showNotification(`Error checking verification: ${error.message}`, 'error');
        }
    }
}

function setupVerificationButtons() {
    document.getElementById('verifyShipperBtn').onclick = async () => {
        await requestVerification('shipper');
    };
    document.getElementById('verifyCarrierBtn').onclick = async () => {
        await requestVerification('carrier');
    };
}

async function requestVerification(role) {
    showNotification(`Verification for ${role} is handled by the contract owner. Please contact them directly.`, 'info');
    closeVerifyModal();
}

function closeVerifyModal() {
    document.getElementById('verifyModal').classList.add('hidden');
}

async function postJob() {
    if (!contract) {
        showNotification('Please connect wallet and deploy contract first', 'error');
        return;
    }

    try {
        const isVerified = await contract.verifiedShippers(userAddress);
        const owner = await contract.owner();

        if (!isVerified) {
            showNotification(`You need to be verified as a shipper first. Contact owner: ${owner}`, 'error');
            document.getElementById('verifyModal').classList.remove('hidden');
            setupVerificationButtons();
            return;
        }

        const origin = document.getElementById('origin').value;
        const destination = document.getElementById('destination').value;
        const cargoType = document.getElementById('cargoType').value;

        if (!origin || !destination || !cargoType) {
            showNotification('Please fill all required fields', 'error');
            return;
        }

        showNotification('Posting job...', 'info');

        const tx = await contract.postJob(origin, destination, cargoType);
        await tx.wait();

        document.getElementById('origin').value = '';
        document.getElementById('destination').value = '';
        document.getElementById('cargoType').value = '';

        showNotification('Job posted successfully!', 'success');

    } catch (error) {
        console.error('Failed to post job:', error);
        console.log('Error details:', {
            code: error.code,
            message: error.message,
            data: error.data
        });

        if (error.code === 'BAD_DATA') {
            showNotification('Contract not properly deployed. Please check the contract address.', 'error');
        } else if (error.message.includes('Not verified shipper')) {
            const owner = await contract.owner();
            showNotification(`You are not verified as a shipper. Contact owner: ${owner}`, 'error');
        } else {
            showNotification(`Failed to post job: ${error.message}`, 'error');
        }
    }
}

async function loadAvailableJobs() {
    if (!contract) return;

    try {
        const jobCounter = await contract.jobCounter();
        const availableJobsDiv = document.getElementById('availableJobs');
        availableJobsDiv.innerHTML = '';

        if (jobCounter === 0n) {
            availableJobsDiv.innerHTML = '<p class="text-gray-500 text-center py-8">No jobs available</p>';
            return;
        }

        let hasJobs = false;
        for (let i = 1; i <= Number(jobCounter); i++) {
            try {
                const jobInfo = await contract.getJobInfo(i);
                const jobDetails = await contract.freightJobs(i);

                if (jobDetails.status === 0) {
                    const bidders = await contract.getBidders(i);
                    const jobCard = createJobCard(i, jobDetails, bidders.length, true);
                    availableJobsDiv.appendChild(jobCard);
                    hasJobs = true;
                }
            } catch (error) {
                console.error(`Error loading job ${i}:`, error);
            }
        }

        if (!hasJobs) {
            availableJobsDiv.innerHTML = '<p class="text-gray-500 text-center py-8">No active jobs available</p>';
        }
    } catch (error) {
        console.error('Failed to load jobs:', error);
        if (error.code === 'BAD_DATA') {
            document.getElementById('availableJobs').innerHTML = '<p class="text-red-500 text-center py-8">Contract not deployed. Please deploy the contract first.</p>';
        }
    }
}

async function loadMyJobs() {
    if (!contract) return;

    try {
        const jobCounter = await contract.jobCounter();
        const myJobsDiv = document.getElementById('myJobs');
        myJobsDiv.innerHTML = '';

        if (jobCounter === 0n) {
            myJobsDiv.innerHTML = '<p class="text-gray-500 text-center py-8">You haven\'t posted any jobs yet</p>';
            return;
        }

        let hasJobs = false;
        for (let i = 1; i <= Number(jobCounter); i++) {
            try {
                const jobDetails = await contract.freightJobs(i);

                if (jobDetails.shipper.toLowerCase() === userAddress.toLowerCase()) {
                    const bidders = await contract.getBidders(i);
                    const jobCard = createJobCard(i, jobDetails, bidders.length, false);
                    myJobsDiv.appendChild(jobCard);
                    hasJobs = true;
                }
            } catch (error) {
                console.error(`Error loading job ${i}:`, error);
            }
        }

        if (!hasJobs) {
            myJobsDiv.innerHTML = '<p class="text-gray-500 text-center py-8">You haven\'t posted any jobs yet</p>';
        }
    } catch (error) {
        console.error('Failed to load my jobs:', error);
        if (error.code === 'BAD_DATA') {
            document.getElementById('myJobs').innerHTML = '<p class="text-red-500 text-center py-8">Contract not deployed. Please deploy the contract first.</p>';
        }
    }
}

async function loadMyBids() {
    if (!contract) return;

    try {
        const myBidsDiv = document.getElementById('myBids');
        myBidsDiv.innerHTML = '';

        const jobCounter = await contract.jobCounter();
        let hasBids = false;

        for (let i = 1; i <= Number(jobCounter); i++) {
            try {
                const bidInfo = await contract.getBidInfo(i, userAddress);
                if (bidInfo.hasSubmitted) {
                    const jobDetails = await contract.freightJobs(i);
                    const bidCard = createBidCard(i, jobDetails, bidInfo);
                    myBidsDiv.appendChild(bidCard);
                    hasBids = true;
                }
            } catch (error) {
                console.error(`Error loading bid for job ${i}:`, error);
            }
        }

        if (!hasBids) {
            myBidsDiv.innerHTML = '<p class="text-gray-500 text-center py-8">You haven\'t submitted any bids yet</p>';
        }
    } catch (error) {
        console.error('Failed to load my bids:', error);
    }
}

function createJobCard(jobId, jobDetails, bidCount, showBidButton) {
    const card = document.createElement('div');
    card.className = 'border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow';

    const statusText = ['Open', 'Bidding Closed', 'Awarded', 'Completed', 'Cancelled'][jobDetails.status];
    const randomColors = ['text-green-600', 'text-yellow-600', 'text-purple-600', 'text-indigo-600', 'text-red-600'];
    const statusColor = randomColors[jobDetails.status];
    const randomBtnColor = getRandomTailwindColor();

    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <h3 class="text-lg font-semibold text-gray-800">Job #${jobId}</h3>
            <span class="px-3 py-1 text-sm font-medium ${statusColor} bg-gray-100 rounded-full">${statusText}</span>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
                <p class="text-sm text-gray-600">Origin</p>
                <p class="font-medium">${jobDetails.origin}</p>
            </div>
            <div>
                <p class="text-sm text-gray-600">Destination</p>
                <p class="font-medium">${jobDetails.destination}</p>
            </div>
            <div>
                <p class="text-sm text-gray-600">Cargo Type</p>
                <p class="font-medium">${jobDetails.cargoType}</p>
            </div>
            <div>
                <p class="text-sm text-gray-600">Weight/Volume</p>
                <p class="font-medium">${jobDetails.weight}kg / ${jobDetails.volume}m³</p>
            </div>
        </div>
        <div class="flex justify-between items-center">
            <div class="text-sm text-gray-600">
                <i class="fas fa-users mr-1"></i>
                ${bidCount} bids
            </div>
            <div class="space-x-2">
                ${showBidButton && jobDetails.status === 0 ? `
                    <button onclick="openBidModal(${jobId})" class="bg-${randomBtnColor}-600 text-white px-4 py-2 rounded-lg hover:bg-${randomBtnColor}-700 text-sm random-color-bg">
                        <i class="fas fa-gavel mr-1"></i>
                        Bid
                    </button>
                ` : ''}
                ${!showBidButton ? `
                    <button onclick="viewBids(${jobId})" class="bg-${randomBtnColor}-600 text-white px-4 py-2 rounded-lg hover:bg-${randomBtnColor}-700 text-sm random-color-bg">
                        <i class="fas fa-eye mr-1"></i>
                        View Bids
                    </button>
                    ${jobDetails.status === 0 ? `
                        <button onclick="closeBidding(${jobId})" class="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm">
                            <i class="fas fa-lock mr-1"></i>
                            Close Bidding
                        </button>
                    ` : ''}
                ` : ''}
            </div>
        </div>
    `;

    return card;
}

function createBidCard(jobId, jobDetails, bidInfo) {
    const card = document.createElement('div');
    card.className = 'border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow';

    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <h3 class="text-lg font-semibold text-gray-800">Bid for Job #${jobId}</h3>
            <span class="px-3 py-1 text-sm font-medium ${bidInfo.isRevealed ? 'text-purple-600' : 'text-yellow-600'} bg-gray-100 rounded-full">
                ${bidInfo.isRevealed ? 'Revealed' : 'Encrypted'}
            </span>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
                <p class="text-sm text-gray-600">Route</p>
                <p class="font-medium">${jobDetails.origin} → ${jobDetails.destination}</p>
            </div>
            <div>
                <p class="text-sm text-gray-600">Cargo</p>
                <p class="font-medium">${jobDetails.cargoType}</p>
            </div>
            ${bidInfo.isRevealed ? `
                <div>
                    <p class="text-sm text-gray-600">Your Bid</p>
                    <p class="font-medium">${bidInfo.revealedPrice} USD</p>
                </div>
            ` : `
                <div>
                    <p class="text-sm text-gray-600">Status</p>
                    <p class="font-medium">Encrypted (Private)</p>
                </div>
            `}
        </div>
        ${!bidInfo.isRevealed && jobDetails.status === 1 ? `
            <button onclick="revealBid(${jobId})" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm random-color-bg">
                <i class="fas fa-unlock mr-1"></i>
                Reveal Bid
            </button>
        ` : ''}
    `;

    return card;
}

function openBidModal(jobId) {
    selectedJobId = jobId;
    document.getElementById('bidModal').classList.remove('hidden');
}

function closeBidModal() {
    document.getElementById('bidModal').classList.add('hidden');
    selectedJobId = 0;
    document.getElementById('bidPrice').value = '';
}

async function submitBid() {
    if (!contract || !selectedJobId) {
        showNotification('Please select a job first', 'error');
        return;
    }

    try {
        const isVerified = await contract.verifiedCarriers(userAddress);
        const owner = await contract.owner();

        if (!isVerified) {
            showNotification(`You need to be verified as a carrier first. Contact owner: ${owner}`, 'error');
            document.getElementById('verifyModal').classList.remove('hidden');
            setupVerificationButtons();
            return;
        }

        const price = document.getElementById('bidPrice').value;

        if (!price) {
            showNotification('Please enter a bid price', 'error');
            return;
        }

        showNotification('Submitting bid...', 'info');

        const priceInt = parseInt(price);
        const tx = await contract.submitBid(selectedJobId, priceInt);
        await tx.wait();

        closeBidModal();
        showNotification('Bid submitted successfully!', 'success');

    } catch (error) {
        console.error('Failed to submit bid:', error);
        console.log('Error details:', {
            code: error.code,
            message: error.message,
            data: error.data
        });

        if (error.message.includes('Not verified carrier')) {
            const owner = await contract.owner();
            showNotification(`You are not verified as a carrier. Contact owner: ${owner}`, 'error');
        } else if (error.message.includes('Already submitted')) {
            showNotification('You have already submitted a bid for this job', 'warning');
        } else {
            showNotification(`Failed to submit bid: ${error.message}`, 'error');
        }
    }
}

async function revealBid(jobId) {
    try {
        const price = prompt('Enter your original bid price to reveal:');
        if (!price) return;

        const priceInt = parseInt(price);
        const tx = await contract.revealBid(jobId, priceInt);
        await tx.wait();

        showNotification('Bid revealed successfully!', 'success');
        loadMyBids();
    } catch (error) {
        console.error('Failed to reveal bid:', error);
        showNotification('Failed to reveal bid', 'error');
    }
}

async function closeBidding(jobId) {
    try {
        const tx = await contract.closeBidding(jobId);
        await tx.wait();

        showNotification('Bidding closed for job!', 'success');
        loadMyJobs();
    } catch (error) {
        console.error('Failed to close bidding:', error);
        showNotification('Failed to close bidding', 'error');
    }
}

async function viewBids(jobId) {
    if (!contract) return;

    try {
        const bidders = await contract.getBidders(jobId);
        console.log(`Job ${jobId} has ${bidders.length} bidders:`, bidders);

        showNotification(`This job has ${bidders.length} bids`, 'info');
    } catch (error) {
        console.error('Failed to view bids:', error);
    }
}

async function loadStats() {
    try {
        if (contract) {
            const jobCounter = await contract.jobCounter();
            let activeJobs = 0;

            for (let i = 1; i <= Number(jobCounter); i++) {
                try {
                    const jobDetails = await contract.freightJobs(i);
                    if (jobDetails.status === 0) {
                        activeJobs++;
                    }
                } catch (error) {
                    console.error(`Error loading job ${i} for stats:`, error);
                }
            }

            document.getElementById('activeJobs').textContent = activeJobs;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Owner verification functions
async function verifyUserAsShipper() {
    const address = document.getElementById('shipperAddress').value;
    if (!address) {
        showNotification('Please enter a shipper address', 'error');
        return;
    }

    try {
        showNotification('Verifying shipper...', 'info');
        const tx = await contract.verifyShipper(address);
        await tx.wait();

        showNotification(`Successfully verified ${address} as shipper!`, 'success');
        document.getElementById('shipperAddress').value = '';
        await updateVerificationStatus();
    } catch (error) {
        console.error('Error verifying shipper:', error);
        showNotification(`Failed to verify shipper: ${error.message}`, 'error');
    }
}

async function verifyUserAsCarrier() {
    const address = document.getElementById('carrierAddress').value;
    if (!address) {
        showNotification('Please enter a carrier address', 'error');
        return;
    }

    try {
        showNotification('Verifying carrier...', 'info');
        const tx = await contract.verifyCarrier(address);
        await tx.wait();

        showNotification(`Successfully verified ${address} as carrier!`, 'success');
        document.getElementById('carrierAddress').value = '';
        await updateVerificationStatus();
    } catch (error) {
        console.error('Error verifying carrier:', error);
        showNotification(`Failed to verify carrier: ${error.message}`, 'error');
    }
}

async function verifySelfAsShipper() {
    if (!userAddress) {
        showNotification('Please connect your wallet first', 'error');
        return;
    }

    try {
        showNotification('Verifying yourself as shipper...', 'info');
        const tx = await contract.verifyShipper(userAddress);
        await tx.wait();

        showNotification('You are now verified as a shipper!', 'success');
        await updateVerificationStatus();
    } catch (error) {
        console.error('Error verifying self as shipper:', error);
        showNotification(`Failed to verify as shipper: ${error.message}`, 'error');
    }
}

async function verifySelfAsCarrier() {
    if (!userAddress) {
        showNotification('Please connect your wallet first', 'error');
        return;
    }

    try {
        showNotification('Verifying yourself as carrier...', 'info');
        const tx = await contract.verifyCarrier(userAddress);
        await tx.wait();

        showNotification('You are now verified as a carrier!', 'success');
        await updateVerificationStatus();
    } catch (error) {
        console.error('Error verifying self as carrier:', error);
        showNotification(`Failed to verify as carrier: ${error.message}`, 'error');
    }
}

async function checkUserStatus() {
    const address = document.getElementById('checkAddress').value;
    if (!address) {
        showNotification('Please enter an address to check', 'error');
        return;
    }

    try {
        const isShipper = await contract.verifiedShippers(address);
        const isCarrier = await contract.verifiedCarriers(address);

        let status = 'Not Verified';
        if (isShipper && isCarrier) {
            status = 'Verified as both Shipper & Carrier';
        } else if (isShipper) {
            status = 'Verified as Shipper only';
        } else if (isCarrier) {
            status = 'Verified as Carrier only';
        }

        showNotification(`${address.substring(0, 6)}...${address.substring(38)}: ${status}`, 'info');
        document.getElementById('checkAddress').value = '';
    } catch (error) {
        console.error('Error checking user status:', error);
        showNotification(`Failed to check status: ${error.message}`, 'error');
    }
}

function showNotification(message, type = 'info') {
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-purple-500'
    };

    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}