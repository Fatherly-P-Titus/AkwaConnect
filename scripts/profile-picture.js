// profile-picture.js - Handle profile picture upload and processing
class ProfilePictureHandler {
    constructor() {
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        this.imageData = null;
        this.cropper = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Upload area click
        $('#uploadArea').on('click', () => {
            $('#profilePicture').click();
        });
        
        // File input change
        $('#profilePicture').on('change', (e) => {
            this.handleFileSelect(e);
        });
        
        // Change picture button
        $(document).on('click', '.change-pic', () => {
            $('#profilePicture').click();
        });
        
        // Remove picture button
        $(document).on('click', '.remove-pic', () => {
            this.removePicture();
        });
        
        // Initialize cropper modal
        $('#crop-modal').modal({
            onOpenStart: () => this.initCropper(),
            onCloseEnd: () => this.destroyCropper()
        });
        
        // Crop button
        $('#crop-image').on('click', () => {
            this.cropImage();
        });
        
        // Cancel crop button
        $('#cancel-crop').on('click', () => {
            $('#crop-modal').modal('close');
        });
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        
        if (!file) return;
        
        // Validate file type
        if (!this.allowedTypes.includes(file.type)) {
            showToast('Please upload a JPG, PNG, GIF, or WebP image', 'error');
            return;
        }
        
        // Validate file size
        if (file.size > this.maxFileSize) {
            showToast('Image size must be less than 5MB', 'error');
            return;
        }
        
        // Read the file
        const reader = new FileReader();
        reader.onload = (e) => {
            this.imageData = e.target.result;
            
            // Show crop modal for image editing
            this.showCropModal(this.imageData);
        };
        reader.readAsDataURL(file);
    }
    
    showCropModal(imageData) {
        $('#crop-image-container').html(`<img id="image-to-crop" src="${imageData}" alt="Image to crop">`);
        $('#crop-modal').modal('open');
    }
    
    initCropper() {
        const image = document.getElementById('image-to-crop');
        if (image) {
            this.cropper = new Cropper(image, {
                aspectRatio: 1,
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 0.8,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
                ready: () => {
                    // Ensure crop box is square
                    const cropBoxData = this.cropper.getCropBoxData();
                    const size = Math.min(cropBoxData.width, cropBoxData.height);
                    this.cropper.setCropBoxData({
                        width: size,
                        height: size
                    });
                }
            });
        }
    }
    
    cropImage() {
        if (!this.cropper) return;
        
        // Get cropped canvas
        const canvas = this.cropper.getCroppedCanvas({
            width: 400,
            height: 400,
            fillColor: '#fff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });
        
        // Convert to data URL
        this.imageData = canvas.toDataURL('image/jpeg', 0.9);
        
        // Update preview
        this.updatePreview(this.imageData);
        
        // Close modal
        $('#crop-modal').modal('close');
        
        // Store in localStorage temporarily
        localStorage.setItem('tempProfilePicture', this.imageData);
    }
    
    updatePreview(imageData) {
        $('#previewImage').attr('src', imageData);
        $('#uploadArea').hide();
        $('#imagePreview').show();
    }
    
    removePicture() {
        this.imageData = null;
        $('#profilePicture').val('');
        $('#imagePreview').hide();
        $('#uploadArea').show();
        localStorage.removeItem('tempProfilePicture');
    }
    
    destroyCropper() {
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
    }
    
    getImageData() {
        return this.imageData;
    }
    
    // Upload to server
    async uploadToServer(userId) {
        if (!this.imageData) return null;
        
        try {
            // Convert data URL to blob
            const blob = this.dataURLtoBlob(this.imageData);
            const formData = new FormData();
            formData.append('profilePicture', blob, `profile_${userId}.jpg`);
            formData.append('userId', userId);
            
            // Upload to server
            const response = await fetch(`${window.authManager?.apiBaseUrl || '/api'}/upload-profile-picture`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.authManager?.authToken}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Upload failed');
            }
            
            const data = await response.json();
            return data.imageUrl;
            
        } catch (error) {
            console.error('Profile picture upload error:', error);
            // Fallback: store as base64 in localStorage
            localStorage.setItem(`profile_picture_${userId}`, this.imageData);
            return this.imageData; // Return base64 as fallback
        }
    }
    
    // Convert data URL to blob
    dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        
        return new Blob([u8arr], { type: mime });
    }
    
    // Load profile picture from storage
    loadProfilePicture(userId) {
        // Try localStorage first
        const base64Image = localStorage.getItem(`profile_picture_${userId}`);
        if (base64Image) {
            return base64Image;
        }
        
        // Return default avatar
        return this.generateDefaultAvatar(userId);
    }
    
    // Generate default avatar with initials
    generateDefaultAvatar(userId) {
        // In a real app, you'd generate a colored avatar with user initials
        // For now, return a placeholder
        return 'data:image/svg+xml;base64,' + btoa(`
            <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="200" fill="#10b981"/>
                <text x="100" y="110" font-family="Arial" font-size="80" fill="white" text-anchor="middle" dominant-baseline="middle">U</text>
            </svg>
        `);
    }
}

// Initialize profile picture handler
let profilePictureHandler;

$(document).ready(function() {
    profilePictureHandler = new ProfilePictureHandler();
    
    // Load temporary picture if exists
    const tempPicture = localStorage.getItem('tempProfilePicture');
    if (tempPicture) {
        profilePictureHandler.updatePreview(tempPicture);
        profilePictureHandler.imageData = tempPicture;
    }
});

// Export for use in other files
window.ProfilePictureHandler = ProfilePictureHandler;
window.profilePictureHandler = profilePictureHandler;