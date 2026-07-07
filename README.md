# SEWALEVEL Calculator

## Description
The SEWALEVEL Calculator is a web application designed to help users calculate the experience points (XP) and packs needed to reach a desired level in a game. It provides an estimate of the total cost and duration required to achieve the target level.

## Features
- Input current level and experience points.
- Specify a target level.
- Option to use a faster, more expensive method for leveling up.
- Dynamic calculation of required XP, total XP bought, total duration, and total price.
- Recommendations for purchasing packs based on user input.
- Visual representation of recommended packs with details on price and duration.
- Integration with a Discord server for community support.

## Technologies Used
- HTML
- CSS (Bootstrap)
- JavaScript

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/sewalevel-calculator.git

## Usage
1. Enter your current level and experience points.
2. Specify your target level.
3. Optionally, check the box to use the faster method.
4. The calculator will display the required XP, total XP bought, total duration, and total price.
5. Recommended packs will be displayed dynamically based on your input.

## Recommended Packs
The calculator recommends packs based on the required XP and whether the faster method is selected. The packs include:
- Supreme Pack
- Mega Pack
- Premium Pack
- Regular Pack

## Contributing
Contributions are welcome! If you have suggestions for improvements or new features, please open an issue or submit a pull request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments
- Thanks to the Bootstrap framework for styling.
- Special thanks to the community for their support and feedback.

## Contact
For any inquiries or support, please reach out to sewalevel@gmail.com.

## Discord Server
Join our SEWALEVEL Discord server for community discussions and support! [Join Here](https://discord.gg/sewalevel).

## Guild Commands
- `/guild create <name> <required_exp>`
  - Creates a new channel in the guild category
  - Only accessible by Guild Leader
  - Creates channel with format: 🛠〣︱︲${name}
  - Sets required EXP goal for the channel

- `/guild remove <name/id>`
  - Removes a channel from the guild category
  - Only accessible by Guild Leader
  - Deletes the channel and its associated data
  - Can use either channel name or ID

- `/guild show`
  - Shows EXP data for current channel
  - Displays individual user EXP and expenses
  - Shows total guild EXP and required EXP
  - Shows total expenses (1M EXP = 1DL)
  - Accessible by Admin and Guild Service roles

## Database Commands
- `/database add <name> <user>`
  - Links a user to a guild channel
  - Only accessible by Admin role
  - Adds user to leaderboard tracking
  - Initializes user's EXP data

- `/database remove <name>`
  - Removes a user from the database
  - Only accessible by Admin role
  - Removes user from leaderboard tracking
  - Deletes associated data

## Calculator Commands
- `/calculator`
  - Opens calculator modal for EXP calculations
  - Input: Starting Level, Target Level
  - Shows required EXP and estimated costs
  - Provides fast/slow method options

## Left-Jar Commands
- `/left-jar`
  - Shows total left-jar statistics
  - Displays jar counts by type
  - Regular/Premium/Mega/Supreme jars

## Pack Commands
- `/pack`
  - Shows total pack statistics
  - Displays pack counts by type
  - Regular/Premium/Mega/Supreme packs

## Collection Commands
- `/collect`
  - Shows collection statistics
  - Displays total items collected
  - Shows collection history

## Show Commands
- `/show`
  - Shows general statistics
  - Displays various bot metrics
  - Overview of all activities

## Update Commands
- `/update`
  - Updates various bot settings
  - Only accessible by Admin role
  - Configuration management

## Currency Conversion
- World Lock (WL)
- Diamond Lock (DL) = 100 WL
- Blue Gem Lock (BGL) = 100 DL
