# Define the level progression function based on the formula given:
# (50 * (B2 + (n - 1))^2 + 100), where B2 is the base level (1 here), and we increment up to level 125.

# Starting at level 1 and summing up to each next level, we will accumulate the experience required to reach each level.
# Create a list to store the cumulative experience for each level

# Define parameters
base_level = 1
max_level = 125

# Calculate cumulative experience for each level up to max_level
exp_requirements = []
cumulative_exp = 0

for level in range(2, max_level + 1):
    # Calculate experience for the current level based on the formula and add it to the cumulative sum
    exp_for_level = 50 * (base_level + (level - 2))**2 + 100
    cumulative_exp += exp_for_level
    exp_requirements.append(cumulative_exp)

exp_requirements[:10]  # Display the first 10 cumulative experience values as a sample output
