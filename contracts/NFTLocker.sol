// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

interface IERC721 {
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId
    );
    event Approval(
        address indexed owner,
        address indexed approved,
        uint256 indexed tokenId
    );
    event ApprovalForAll(
        address indexed owner,
        address indexed operator,
        bool approved
    );

    function balanceOf(address owner) external view returns (uint256 balance);

    function ownerOf(uint256 tokenId) external view returns (address owner);

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) external;

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function transferFrom(address from, address to, uint256 tokenId) external;

    function approve(address to, uint256 tokenId) external;

    function setApprovalForAll(address operator, bool approved) external;

    function getApproved(
        uint256 tokenId
    ) external view returns (address operator);

    function isApprovedForAll(
        address owner,
        address operator
    ) external view returns (bool);
}

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

pragma solidity 0.8.19;

contract NFTLocker {
    mapping(address => mapping(address => mapping(uint256 => DepositData)))
        public deposits;
    address[] public depositors;
    mapping(address => bool) private isDepositor;

    struct DepositData {
        uint256 createdAt;
        uint256 lockForDays;
    }

    modifier onlyConfigured(
        address _account,
        address _token,
        uint256 _tokenId
    ) {
        require(
            deposits[_account][_token][_tokenId].lockForDays != 0,
            "Token not configured!"
        );
        _;
    }

    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata
    ) external view onlyConfigured(from, msg.sender, tokenId) returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function deposit(
        address _token,
        uint256 _tokenId,
        uint256 _lockForDays
    ) external {
        require(
            deposits[msg.sender][_token][_tokenId].lockForDays == 0,
            "Token already configured!"
        );

        require(_lockForDays > 0, "Invalid lockForDays value.");

        if (isDepositor[msg.sender] == false) {
            depositors.push(msg.sender);
            isDepositor[msg.sender] = true;
        }

        DepositData memory newDeposit = DepositData({
            createdAt: block.timestamp,
            lockForDays: _lockForDays
        });

        deposits[msg.sender][_token][_tokenId] = newDeposit;

        IERC721(_token).safeTransferFrom(msg.sender, address(this), _tokenId);
    }

    function canWithdraw(
        address _account,
        address _token,
        uint256 _tokenId
    ) public view onlyConfigured(_account, _token, _tokenId) returns (bool) {
        DepositData memory depositData = deposits[_account][_token][_tokenId];

        uint256 releaseAt = depositData.createdAt +
            (depositData.lockForDays * 1 days);
        return releaseAt < block.timestamp;
    }

    function withdraw(
        address _token,
        uint256 _tokenId
    ) external onlyConfigured(msg.sender, _token, _tokenId) {
        require(
            canWithdraw(msg.sender, _token, _tokenId),
            "You cannot withdraw yet!"
        );

        IERC721(_token).safeTransferFrom(address(this), msg.sender, _tokenId);

        delete deposits[msg.sender][_token][_tokenId];
    }

    function increaseLockForDays(
        address _token,
        uint256 _tokenId,
        uint256 _newLockForDays
    ) external onlyConfigured(msg.sender, _token, _tokenId) {
        DepositData storage depositData = deposits[msg.sender][_token][
            _tokenId
        ];

        require(
            depositData.lockForDays < _newLockForDays,
            "New lockForDays value invalid!"
        );

        depositData.lockForDays = _newLockForDays;
    }

    function getDepositors() external view returns (address[] memory) {
        return depositors;
    }
}
