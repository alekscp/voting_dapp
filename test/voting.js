const Voting = artifacts.require('Voting');

contract('Voting', accounts => {
  before(async () => {
    instance = await Voting.deployed();
    originalBlock = await web3.eth.getBlock('latest');
    electionName = web3.utils.toHex('test');
    registrationDeadline = 60, votingDeadline = 120, endingTime = 240;
    await instance.newElection(electionName, registrationDeadline, votingDeadline, endingTime, { from: accounts[0] });
  });

  describe('newElection', async () => {
    it('creates an election', async () => {
      const election = await instance.elections(0);
      assert.exists(election.name);
    });

    it('sets registrationDeadline relative to current block timestamp', async () => {
      const election = await instance.elections(0);
      assert.strictEqual(election.registrationDeadline.toNumber(), originalBlock.timestamp + registrationDeadline);
    });

    it('sets votingDeadline relative to current block timestamp', async () => {
      const election = await instance.elections(0);
      assert.strictEqual(election.votingDeadline.toNumber(), originalBlock.timestamp + votingDeadline);
    });

    it('sets endingTime relative to current block timestamp', async () => {
      const election = await instance.elections(0);
      assert.strictEqual(election.endingTime.toNumber(), originalBlock.timestamp + endingTime);
    });

    it('should NOT create an election if name is already taken', async () => {
      try {
        await instance.newElection(electionName, registrationDeadline, votingDeadline, endingTime, { from: accounts[0] });
      } catch (error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'Election with that name already exists.');
    });
  });

  describe('registerCandidate', async () => {
    // before(async () => {
    //   instance = await Voting.deployed();
    //   electionName = web3.utils.toHex('test');
    //   registrationDeadline = 60, votingDeadline = 120, endingTime = 240;
    //   await instance.newElection(electionName, registrationDeadline, votingDeadline, endingTime, { from: accounts[0] });
    // });

    it('registers a candidate to a given election', async () => {
      const electionName = web3.utils.toHex('test');
      const candidateName = web3.utils.toHex('Bob');
      await instance.registerCandidate(electionName, candidateName, { from: accounts[0] });
      const election = await instance.elections(0);
      const candidate = await instance.candidates(accounts[0]);

      assert.isOk(candidate);
      assert.strictEqual(web3.utils.hexToUtf8(candidate.electionName), web3.utils.hexToUtf8(electionName));
    });

    it('errors if the election does not exist', async () => {
      const otherElectionName = web3.utils.toHex('other');
      const candidateName = web3.utils.toHex('Bob');

      try {
        await instance.registerCandidate(otherElectionName, candidateName, { from: accounts[0] });
      } catch(error) {
        err = error
      }

      assert.isOk(err instanceof Error);
      assert.equal(err.reason, 'No election with that name found.');
    });

  })
});
