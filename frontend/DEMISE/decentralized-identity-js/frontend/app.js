// Advanced DID System Frontend Application
class DIDSystem {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.identityRegistry = null;
        this.credentialRegistry = null;
        this.userAddress = null;
        this.userDID = null;
        
        // Contract addresses (update these after deployment)
        this.contractAddresses = {
            identityRegistry: "0x...", // Update with actual address
            credentialRegistry: "0x..." // Update with actual address
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.showConnectionStatus();
    }

    setupEventListeners() {
        // Wallet connection
        document.getElementById('connectWallet').addEventListener('click', () => this.connectWallet());
        
        // Tab navigation
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Identity management
        document.getElementById('createDIDBtn').addEventListener('click', () => this.createDID());
        document.getElementById('updateDIDBtn').addEventListener('click', () => this.updateDID());
        document.getElementById('deactivateDIDBtn').addEventListener('click', () => this.deactivateDID());
        
        // Credential management
        document.getElementById('addCredentialBtn').addEventListener('click', () => this.showAddCredentialModal());
        document.getElementById('verifyCredentialBtn').addEventListener('click', () => this.verifyCredential());
        
        // Check for MetaMask
        if (typeof window.ethereum !== 'undefined') {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnectWallet();
                } else {
                    this.connectWallet();
                }
            });
        }
    }

    async connectWallet() {
        try {
            if (typeof window.ethereum === 'undefined') {
                this.showMessage('MetaMask is not installed. Please install MetaMask to continue.', 'error');
                return;
            }

            this.showLoading(true);
            
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.userAddress = accounts[0];
            
            // Create provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            
            // Initialize contracts
            await this.initializeContracts();
            
            // Load user data
            await this.loadUserData();
            
            // Update UI
            this.updateWalletInfo();
            this.hideConnectionStatus();
            this.showDashboard();
            
            this.showMessage('Wallet connected successfully!', 'success');
            
        } catch (error) {
            console.error('Error connecting wallet:', error);
            this.showMessage('Failed to connect wallet: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async initializeContracts() {
        // Contract ABIs (simplified - in production, load from JSON files)
        const identityRegistryABI = [
            "function createDID(string memory did, string[] memory context, string[] memory verificationMethod) external",
            "function updateDID(string memory did, string[] memory context, string[] memory verificationMethod) external",
            "function deactivateDID(string memory did) external",
            "function resolveDID(address user) external view returns (tuple(string id, string[] context, string[] verificationMethod, string[] authentication, string[] assertionMethod, string[] capabilityInvocation, string[] capabilityDelegation, string[] keyAgreement, string[] service, uint256 created, uint256 updated, bool active))",
            "function resolveDIDById(string memory did) external view returns (tuple(string id, string[] context, string[] verificationMethod, string[] authentication, string[] assertionMethod, string[] capabilityInvocation, string[] capabilityDelegation, string[] keyAgreement, string[] service, uint256 created, uint256 updated, bool active))",
            "function hasActiveDID(address user) external view returns (bool)",
            "function getTotalDIDs() external view returns (uint256)"
        ];

        const credentialRegistryABI = [
            "function issueCredential(string memory subject, string memory credentialType, string[] memory claimKeys, string[] memory claimValues, uint256 expirationDate, string memory credentialSchema, bool supportsSelectiveDisclosure) external",
            "function issueCredentialWithZKProof(string memory subject, string memory credentialType, string memory zkProof, uint256 expirationDate) external",
            "function revokeCredential(uint256 credentialId, string memory reason) external",
            "function suspendCredential(uint256 credentialId, string memory reason) external",
            "function reactivateCredential(uint256 credentialId) external",
            "function verifyCredential(uint256 credentialId) external view returns (bool)",
            "function getCredential(uint256 credentialId) external view returns (string memory id, string[] memory type, string memory issuer, string memory subject, uint256 issuanceDate, uint256 expirationDate, string memory credentialStatus, string memory credentialSchema, bool selectiveDisclosure, string memory zkProof)",
            "function getCredentialClaim(uint256 credentialId, string memory claimKey) external view returns (string memory)",
            "function getAllCredentialClaims(uint256 credentialId) external view returns (string[] memory claimKeys, string[] memory claimValues)",
            "function getSubjectCredentials(string memory subject) external view returns (uint256[] memory)",
            "function getTotalCredentials() external view returns (uint256)",
            "function authorizedIssuers(address issuer) external view returns (bool)"
        ];

        // Initialize contract instances
        this.identityRegistry = new ethers.Contract(
            this.contractAddresses.identityRegistry,
            identityRegistryABI,
            this.signer
        );

        this.credentialRegistry = new ethers.Contract(
            this.contractAddresses.credentialRegistry,
            credentialRegistryABI,
            this.signer
        );
    }

    async loadUserData() {
        try {
            // Check if user has a DID
            const hasDID = await this.identityRegistry.hasActiveDID(this.userAddress);
            
            if (hasDID) {
                const didDoc = await this.identityRegistry.resolveDID(this.userAddress);
                this.userDID = didDoc.id;
                this.displayDIDDetails(didDoc);
            } else {
                this.showCreateDIDForm();
            }

            // Load credentials if user has DID
            if (this.userDID) {
                await this.loadUserCredentials();
            }

            // Update stats
            await this.updateStats();

        } catch (error) {
            console.error('Error loading user data:', error);
            this.showMessage('Failed to load user data: ' + error.message, 'error');
        }
    }

    async createDID() {
        try {
            const did = document.getElementById('didInput').value;
            const verificationMethod = document.getElementById('verificationMethodInput').value;

            if (!did || !verificationMethod) {
                this.showMessage('Please fill in all required fields', 'error');
                return;
            }

            this.showLoading(true);

            const context = ["https://www.w3.org/ns/did/v1"];
            const verificationMethods = [verificationMethod];

            const tx = await this.identityRegistry.createDID(did, context, verificationMethods);
            await tx.wait();

            this.showMessage('DID created successfully!', 'success');
            await this.loadUserData();

        } catch (error) {
            console.error('Error creating DID:', error);
            this.showMessage('Failed to create DID: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async updateDID() {
        try {
            const did = this.userDID;
            const verificationMethod = document.getElementById('verificationMethodInput').value;

            if (!verificationMethod) {
                this.showMessage('Please enter a verification method', 'error');
                return;
            }

            this.showLoading(true);

            const context = ["https://www.w3.org/ns/did/v1"];
            const verificationMethods = [verificationMethod];

            const tx = await this.identityRegistry.updateDID(did, context, verificationMethods);
            await tx.wait();

            this.showMessage('DID updated successfully!', 'success');
            await this.loadUserData();

        } catch (error) {
            console.error('Error updating DID:', error);
            this.showMessage('Failed to update DID: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async deactivateDID() {
        try {
            if (!confirm('Are you sure you want to deactivate your DID? This action cannot be undone.')) {
                return;
            }

            this.showLoading(true);

            const tx = await this.identityRegistry.deactivateDID(this.userDID);
            await tx.wait();

            this.showMessage('DID deactivated successfully!', 'success');
            await this.loadUserData();

        } catch (error) {
            console.error('Error deactivating DID:', error);
            this.showMessage('Failed to deactivate DID: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadUserCredentials() {
        try {
            const credentialIds = await this.credentialRegistry.getSubjectCredentials(this.userDID);
            const credentialsList = document.getElementById('credentialsList');
            
            credentialsList.innerHTML = '';

            for (const id of credentialIds) {
                const credential = await this.credentialRegistry.getCredential(id);
                const isValid = await this.credentialRegistry.verifyCredential(id);
                
                const credentialCard = this.createCredentialCard(id, credential, isValid);
                credentialsList.appendChild(credentialCard);
            }

        } catch (error) {
            console.error('Error loading credentials:', error);
            this.showMessage('Failed to load credentials: ' + error.message, 'error');
        }
    }

    createCredentialCard(id, credential, isValid) {
        const card = document.createElement('div');
        card.className = 'bg-white border rounded-lg p-4 shadow-sm';
        
        const statusColor = isValid ? 'green' : 'red';
        const statusText = isValid ? 'Valid' : 'Invalid';
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-medium text-gray-900">Credential #${id}</h4>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${statusColor}-100 text-${statusColor}-800">
                    ${statusText}
                </span>
            </div>
            <div class="text-sm text-gray-600 space-y-1">
                <p><strong>Type:</strong> ${credential.type.join(', ')}</p>
                <p><strong>Issuer:</strong> ${credential.issuer}</p>
                <p><strong>Status:</strong> ${credential.credentialStatus}</p>
                <p><strong>Issued:</strong> ${new Date(credential.issuanceDate * 1000).toLocaleDateString()}</p>
                ${credential.expirationDate > 0 ? `<p><strong>Expires:</strong> ${new Date(credential.expirationDate * 1000).toLocaleDateString()}</p>` : ''}
            </div>
            <div class="mt-3 flex space-x-2">
                <button onclick="didSystem.viewCredentialDetails(${id})" class="text-blue-600 hover:text-blue-800 text-sm">
                    <i class="fas fa-eye mr-1"></i>View Details
                </button>
                <button onclick="didSystem.verifyCredentialById(${id})" class="text-green-600 hover:text-green-800 text-sm">
                    <i class="fas fa-check mr-1"></i>Verify
                </button>
            </div>
        `;
        
        return card;
    }

    async verifyCredential() {
        try {
            const credentialId = document.getElementById('verifyCredentialId').value;
            
            if (!credentialId) {
                this.showMessage('Please enter a credential ID', 'error');
                return;
            }

            this.showLoading(true);

            const isValid = await this.credentialRegistry.verifyCredential(credentialId);
            const credential = await this.credentialRegistry.getCredential(credentialId);

            this.displayVerificationResults(credentialId, credential, isValid);

        } catch (error) {
            console.error('Error verifying credential:', error);
            this.showMessage('Failed to verify credential: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async verifyCredentialById(credentialId) {
        try {
            this.showLoading(true);

            const isValid = await this.credentialRegistry.verifyCredential(credentialId);
            const credential = await this.credentialRegistry.getCredential(credentialId);

            this.displayVerificationResults(credentialId, credential, isValid);

        } catch (error) {
            console.error('Error verifying credential:', error);
            this.showMessage('Failed to verify credential: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayVerificationResults(credentialId, credential, isValid) {
        const resultsDiv = document.getElementById('verificationResults');
        const statusColor = isValid ? 'green' : 'red';
        const statusText = isValid ? 'Valid' : 'Invalid';
        
        resultsDiv.innerHTML = `
            <div class="bg-${statusColor}-50 border border-${statusColor}-200 rounded-lg p-4">
                <div class="flex items-center mb-2">
                    <i class="fas fa-${isValid ? 'check-circle' : 'times-circle'} text-${statusColor}-600 mr-2"></i>
                    <h4 class="font-medium text-${statusColor}-800">Verification Result: ${statusText}</h4>
                </div>
                <div class="text-sm text-${statusColor}-700 space-y-1">
                    <p><strong>Credential ID:</strong> ${credentialId}</p>
                    <p><strong>Type:</strong> ${credential.type.join(', ')}</p>
                    <p><strong>Issuer:</strong> ${credential.issuer}</p>
                    <p><strong>Subject:</strong> ${credential.subject}</p>
                    <p><strong>Status:</strong> ${credential.credentialStatus}</p>
                </div>
            </div>
        `;
        
        resultsDiv.classList.remove('hidden');
    }

    async updateStats() {
        try {
            // Update credential count
            if (this.userDID) {
                const credentialIds = await this.credentialRegistry.getSubjectCredentials(this.userDID);
                document.getElementById('myCredentials').textContent = credentialIds.length;
                
                // Count verified credentials
                let verifiedCount = 0;
                for (const id of credentialIds) {
                    const isValid = await this.credentialRegistry.verifyCredential(id);
                    if (isValid) verifiedCount++;
                }
                document.getElementById('verifiedCount').textContent = verifiedCount;
            }

            // Update DID info
            if (this.userDID) {
                document.getElementById('myDID').textContent = this.userDID;
            }

        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    displayDIDDetails(didDoc) {
        document.getElementById('didIdentifier').textContent = didDoc.id;
        document.getElementById('didStatus').textContent = didDoc.active ? 'Active' : 'Inactive';
        document.getElementById('didStatus').className = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${didDoc.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`;
        document.getElementById('didCreated').textContent = new Date(didDoc.created * 1000).toLocaleString();
        document.getElementById('didUpdated').textContent = new Date(didDoc.updated * 1000).toLocaleString();
        
        document.getElementById('createDIDForm').classList.add('hidden');
        document.getElementById('didDetails').classList.remove('hidden');
    }

    showCreateDIDForm() {
        document.getElementById('createDIDForm').classList.remove('hidden');
        document.getElementById('didDetails').classList.add('hidden');
    }

    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active', 'border-blue-500', 'text-blue-600');
            button.classList.add('border-transparent', 'text-gray-500');
        });
        
        // Show selected tab content
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');
        
        // Add active class to selected tab button
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        activeButton.classList.add('active', 'border-blue-500', 'text-blue-600');
        activeButton.classList.remove('border-transparent', 'text-gray-500');
    }

    updateWalletInfo() {
        document.getElementById('walletAddress').textContent = 
            `${this.userAddress.slice(0, 6)}...${this.userAddress.slice(-4)}`;
        document.getElementById('walletInfo').classList.remove('hidden');
        document.getElementById('connectWallet').classList.add('hidden');
    }

    showConnectionStatus() {
        document.getElementById('connectionStatus').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
    }

    hideConnectionStatus() {
        document.getElementById('connectionStatus').classList.add('hidden');
    }

    showDashboard() {
        document.getElementById('dashboard').classList.remove('hidden');
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    showMessage(message, type = 'info') {
        const container = document.getElementById('messageContainer');
        const messageDiv = document.createElement('div');
        
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        messageDiv.className = `${colors[type]} text-white px-4 py-2 rounded-lg mb-2 flex items-center`;
        messageDiv.innerHTML = `
            <i class="${icons[type]} mr-2"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(messageDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentElement) {
                messageDiv.remove();
            }
        }, 5000);
    }

    disconnectWallet() {
        this.provider = null;
        this.signer = null;
        this.identityRegistry = null;
        this.credentialRegistry = null;
        this.userAddress = null;
        this.userDID = null;
        
        document.getElementById('walletInfo').classList.add('hidden');
        document.getElementById('connectWallet').classList.remove('hidden');
        this.showConnectionStatus();
    }
}

// Initialize the application
const didSystem = new DIDSystem();

