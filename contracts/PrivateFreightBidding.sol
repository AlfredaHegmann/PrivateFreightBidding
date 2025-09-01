// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract PrivateFreightBidding is SepoliaConfig {

    address public owner;
    uint256 public jobCounter;

    enum JobStatus { Open, BiddingClosed, Awarded, Completed, Cancelled }

    struct FreightJob {
        string origin;
        string destination;
        string cargoType;
        uint256 weight;
        uint256 volume;
        uint256 deadline;
        uint256 biddingEndTime;
        address shipper;
        JobStatus status;
        uint256 finalPrice;
        bool isPrivate;
    }

    struct Bid {
        euint32 encryptedPrice;
        bool hasSubmitted;
        bool isRevealed;
        uint32 revealedPrice;
        uint256 timestamp;
    }

    mapping(uint256 => FreightJob) public freightJobs;
    mapping(uint256 => mapping(address => Bid)) public jobBids;
    mapping(uint256 => address[]) public jobBidders;
    mapping(address => bool) public verifiedCarriers;
    mapping(address => bool) public verifiedShippers;

    event JobPosted(uint256 indexed jobId, address indexed shipper);
    event BidSubmitted(uint256 indexed jobId, address indexed carrier);
    event BidRevealed(uint256 indexed jobId, address indexed carrier, uint32 price);
    event JobAwarded(uint256 indexed jobId, address indexed carrier, uint256 finalPrice);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier onlyVerifiedShipper() {
        require(verifiedShippers[msg.sender], "Not verified shipper");
        _;
    }

    modifier onlyVerifiedCarrier() {
        require(verifiedCarriers[msg.sender], "Not verified carrier");
        _;
    }

    constructor() {
        owner = msg.sender;
        jobCounter = 0;
    }

    function verifyCarrier(address _carrier) external onlyOwner {
        verifiedCarriers[_carrier] = true;
    }

    function verifyShipper(address _shipper) external onlyOwner {
        verifiedShippers[_shipper] = true;
    }

    function postJob(
        string memory _origin,
        string memory _destination,
        string memory _cargoType
    ) external onlyVerifiedShipper returns (uint256) {
        jobCounter++;

        freightJobs[jobCounter] = FreightJob({
            origin: _origin,
            destination: _destination,
            cargoType: _cargoType,
            weight: 1000,
            volume: 100,
            deadline: block.timestamp + 7 days,
            biddingEndTime: block.timestamp + 24 hours,
            shipper: msg.sender,
            status: JobStatus.Open,
            finalPrice: 0,
            isPrivate: true
        });

        emit JobPosted(jobCounter, msg.sender);
        return jobCounter;
    }

    function submitBid(uint256 _jobId, uint32 _price) external onlyVerifiedCarrier {
        require(_jobId > 0 && _jobId <= jobCounter, "Invalid job");
        require(freightJobs[_jobId].status == JobStatus.Open, "Job not open");
        require(!jobBids[_jobId][msg.sender].hasSubmitted, "Already submitted");

        euint32 encrypted = FHE.asEuint32(_price);

        jobBids[_jobId][msg.sender] = Bid({
            encryptedPrice: encrypted,
            hasSubmitted: true,
            isRevealed: false,
            revealedPrice: 0,
            timestamp: block.timestamp
        });

        jobBidders[_jobId].push(msg.sender);

        FHE.allowThis(encrypted);
        FHE.allow(encrypted, freightJobs[_jobId].shipper);

        emit BidSubmitted(_jobId, msg.sender);
    }

    function closeBidding(uint256 _jobId) external {
        require(freightJobs[_jobId].shipper == msg.sender, "Not shipper");
        require(freightJobs[_jobId].status == JobStatus.Open, "Job not open");

        freightJobs[_jobId].status = JobStatus.BiddingClosed;
    }

    function revealBid(uint256 _jobId, uint32 _price) external {
        require(jobBids[_jobId][msg.sender].hasSubmitted, "No bid");
        require(!jobBids[_jobId][msg.sender].isRevealed, "Already revealed");

        jobBids[_jobId][msg.sender].isRevealed = true;
        jobBids[_jobId][msg.sender].revealedPrice = _price;

        emit BidRevealed(_jobId, msg.sender, _price);
    }

    function awardJob(uint256 _jobId, address _carrier) external {
        require(freightJobs[_jobId].shipper == msg.sender, "Not shipper");
        require(jobBids[_jobId][_carrier].isRevealed, "Bid not revealed");

        freightJobs[_jobId].status = JobStatus.Awarded;
        freightJobs[_jobId].finalPrice = jobBids[_jobId][_carrier].revealedPrice;

        emit JobAwarded(_jobId, _carrier, freightJobs[_jobId].finalPrice);
    }

    function getJobInfo(uint256 _jobId) external view returns (
        string memory origin,
        string memory destination,
        JobStatus status
    ) {
        FreightJob storage job = freightJobs[_jobId];
        return (job.origin, job.destination, job.status);
    }

    function getBidInfo(uint256 _jobId, address _carrier) external view returns (
        bool hasSubmitted,
        bool isRevealed,
        uint32 revealedPrice
    ) {
        Bid storage bid = jobBids[_jobId][_carrier];
        return (bid.hasSubmitted, bid.isRevealed, bid.revealedPrice);
    }

    function getBidders(uint256 _jobId) external view returns (address[] memory) {
        return jobBidders[_jobId];
    }
}