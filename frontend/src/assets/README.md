# Collection Assets

Place your collection image here with the name `collection-image.png` (or update the script if using a different filename/format).

## Image Requirements

- Recommended size: 800x800 pixels or larger
- Format: PNG or JPG
- Maximum file size: 10MB
- Should be square for best display

## Steps to Add Your Image

1. Name your image file `collection-image.png`
2. Place it in this directory
3. Run the upload script:
   ```bash
   cd frontend
   npm run upload-collection
   ```

The script will:

1. Upload your image to IPFS
2. Create collection metadata using the IPFS image URI
3. Upload the metadata to IPFS
4. Give you the final IPFS URI to use in your contract
